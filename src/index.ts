
import Config = require('webpack-chain')
import { PluginAPI, ProjectOptions } from '@vue/cli-service/types/index.d'

const { info, error, hasProjectYarn, hasProjectPnpm, IpcMessenger } = require('@vue/cli-shared-utils')

const defaults = {
  host: '0.0.0.0',
  port: 8080,
  https: false
}

const webpack = require('webpack')
const { MFSU, esbuildLoader } = require('@umijs/mfsu')
const path = require('path')
const esbuild = require('esbuild')

type mfsuOptions = {
  unMatchLibs: string[]
  useEsbuildLoader: boolean
}

/**
 * @param api 原为build-scripts的调用接口， 现为vue-cli-plugin映射出来的插件钩子
 * @param webpackOptions 原为build-scripts的build.json文件， 现为vue-cli的配置json
 */
module.exports = async (api: PluginAPI, options: ProjectOptions) => {


  // register command
  api.registerCommand(
    'serve:mfsu',
    {
      description: 'Running serve with Webpack 5 Module Federation',
      usage: 'vue-cli-service serve:msfu [options] [entry] same as command serve'
    },
    async function (args) {
      info('Starting development server with mfsu...')

      // although this is primarily a dev server, it is possible that we
      // are running it in a mode with a production env, e.g. in E2E tests.
      const isInContainer = checkInContainer()
      const isProduction = process.env.NODE_ENV === 'production'

      const { chalk } = require('@vue/cli-shared-utils')
      const WebpackDevServer = require('webpack-dev-server')
      const portfinder = require('portfinder')
      const prepareURLs = require('@vue/cli-service/lib/util/prepareURLs')
      const prepareProxy = require('@vue/cli-service/lib/util/prepareProxy')
      const launchEditorMiddleware = require('launch-editor-middleware')
      const validateWebpackConfig = require('@vue/cli-service/lib/util/validateWebpackConfig')
      const isAbsoluteUrl = require('@vue/cli-service/lib/util/isAbsoluteUrl')

      /** ************************* inject by mfsu ************************* */
      const mfsuOptions: mfsuOptions = (options?.pluginOptions as Record<string, any>)?.mfsu ?? {}

      const mfsu = new MFSU({
        implementor: webpack,
        buildDepWithESBuild: true,
        unMatchLibs: ["path", ...(Array.isArray(mfsuOptions.unMatchLibs) ? mfsuOptions.unMatchLibs: [])]
      })
      /** ************************* inject by mfsu ************************* */

      // configs that only matters for dev server
      api.chainWebpack((webpackConfig) => {
        if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {

          if (!webpackConfig.get('devtool')) {
            /** ************************* inject by mfsu ************************* */
            // change 'eval-cheap-module-source-map'(origin in vue-CLI) to 'eval-cheap-source-map'
            // fix debug incorrect
            webpackConfig
              .devtool('eval-cheap-source-map' as Config.DevTool)
              /** ************************* inject by mfsu ************************* */
          }

          // https://github.com/webpack/webpack/issues/6642
          // https://github.com/vuejs/vue-cli/issues/3539
          webpackConfig.output.globalObject(`(typeof self !== 'undefined' ? self : this)`)

          if (!process.env.VUE_CLI_TEST && options.devServer.progress !== false) {
            // the default progress plugin won't show progress due to infrastructreLogging.level
            webpackConfig.plugin('progress').use(require('progress-webpack-plugin'))
          }
        }

        /** ************************* inject by mfsu ************************* */

        webpackConfig.devServer.set('setupMiddlewares', (middlewares) => {
          middlewares.unshift(...mfsu.getMiddlewares())
          return middlewares
        })
        const isTsEnv = webpackConfig.module.rules.has('ts') || webpackConfig.module.rules.has('tsx')


        const jsRule = webpackConfig.module.rule('js')
        let tsRule
        let tsxRule

        isTsEnv && (tsRule = webpackConfig.module.rule("ts")) && (tsxRule = webpackConfig.module.rule("tsx"))

        // using babel-loader
        if (!mfsuOptions.useEsbuildLoader) {
            const tapOptions = (opt: Config.LoaderOptions) => {
                return {
                    ...opt,
                    plugins: opt?.plugins instanceof Array ? [...mfsu.getBabelPlugins(), ...opt.plugins] : [...mfsu.getBabelPlugins()]
                };
            };

            jsRule.use("babel-loader").tap(tapOptions);
            tsRule && tsRule.use("babel-loader").tap(tapOptions);
            tsxRule && tsxRule.use("babel-loader").tap(tapOptions);
        } else {
            // OR
            // using esbuild-loader
            let jsxFactory;
            try {
                jsxFactory = (api.resolve("tsconfig.json") as any).jsxFactory;
            } catch (e) {}

            const esbuildOptions = {
                handler: [
                    // [mfsu] 3. add mfsu esbuild loader handlers
                    ...mfsu.getEsbuildLoaderHandler()
                ],
                target: "esnext",
                implementation: esbuild,
                jsxFactory
            };

            jsRule.uses.clear();
            tsRule && tsRule.uses.clear();
            tsxRule && tsxRule.uses.clear();

            jsRule.use("esbuild-mfsu").loader(esbuildLoader).options(esbuildOptions);
            tsRule && tsRule.use("esbuild-mfsu").loader(esbuildLoader).options(esbuildOptions);
            tsxRule && tsxRule.use("esbuild-mfsu").loader(esbuildLoader).options(esbuildOptions);
        }


        // config entry
        const entrys = webpackConfig.entry('app').values()
        webpackConfig.entry('app').clear()
        entrys.forEach((e) => {
          webpackConfig.entry('app').add(path.resolve(api.service.context, e))
        })

        /** ************************* inject by mfsu ************************* */
      })

      // resolve webpack config
      const webpackConfig = api.resolveWebpackConfig()

      // check for common config errors
      validateWebpackConfig(webpackConfig, api, options)

      // load user devServer options with higher priority than devServer
      // in webpack config
      const projectDevServerOptions = Object.assign(webpackConfig.devServer || {}, options.devServer)

      // expose advanced stats
      if (args.dashboard) {
        const DashboardPlugin = require('@vue/cli-service/lib/webpack/DashboardPlugin')
        webpackConfig.plugins.push(
          new DashboardPlugin({
            type: 'serve'
          })
        )
      }

      // entry arg
      const entry = args._[0]
      if (entry) {
        webpackConfig.entry = {
          app: api.resolve(entry)
        }
      }

      // resolve server options
      const useHttps = args.https || projectDevServerOptions.https || defaults.https
      const protocol = useHttps ? 'https' : 'http'
      const host = args.host || process.env.HOST || projectDevServerOptions.host || defaults.host
      portfinder.basePort = args.port || process.env.PORT || projectDevServerOptions.port || defaults.port
      const port = await portfinder.getPortPromise()
      const rawPublicUrl = args.public || projectDevServerOptions.public
      const publicUrl = rawPublicUrl ? (/^[a-zA-Z]+:\/\//.test(rawPublicUrl) ? rawPublicUrl : `${protocol}://${rawPublicUrl}`) : null
      const publicHost = publicUrl ? /^[a-zA-Z]+:\/\/([^/?#]+)/.exec(publicUrl)[1] : undefined

      const urls = prepareURLs(protocol, host, port, isAbsoluteUrl(options.publicPath) ? '/' : options.publicPath)
      const localUrlForBrowser = publicUrl || urls.localUrlForBrowser

      const proxySettings = prepareProxy(projectDevServerOptions.proxy, api.resolve('public'))

      // inject dev & hot-reload middleware entries
      let webSocketURL
      if (!isProduction) {
        if (publicHost) {
          // explicitly configured via devServer.public
          webSocketURL = {
            protocol: protocol === 'https' ? 'wss' : 'ws',
            hostname: publicHost,
            port
          }
        } else if (isInContainer) {
          // can't infer public network url if inside a container
          // infer it from the browser instead
          webSocketURL = 'auto://0.0.0.0:0/ws'
        } else {
          // otherwise infer the url from the config
          webSocketURL = {
            protocol: protocol === 'https' ? 'wss' : 'ws',
            hostname: urls.lanUrlForConfig || 'localhost',
            port
          }
        }

        if (process.env.APPVEYOR) {
          webpackConfig.plugins.push(new webpack.EntryPlugin(__dirname, 'webpack/hot/poll?500', { name: undefined }))
        }
      }

      const { projectTargets } = require('@vue/cli-service/lib/util/targets')
      const supportsIE = !!projectTargets
      if (supportsIE) {
        webpackConfig.plugins.push(
          // must use undefined as name,
          // to avoid dev server establishing an extra ws connection for the new entry
          new webpack.EntryPlugin(__dirname, 'whatwg-fetch', { name: undefined })
        )
      }

      // fixme: temporary fix to suppress dev server logging
      // should be more robust to show necessary info but not duplicate errors
      webpackConfig.infrastructureLogging = { ...webpackConfig.infrastructureLogging, level: 'none' }
      webpackConfig.stats = 'errors-only'

        /** ************************* inject by mfsu ************************* */

      await mfsu.setWebpackConfig({
        config: webpackConfig
      })

        /** ************************* inject by mfsu ************************* */

      // create compiler
      const compiler = webpack(webpackConfig)

      // handle compiler error
      compiler.hooks.failed.tap('vue-cli-service serve', (msg) => {
        error(msg)
        process.exit(1)
      })

      // create server
      const server = new WebpackDevServer(
        Object.assign(
          {
            historyApiFallback: {
              disableDotRule: true,
              htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              rewrites: genHistoryApiFallbackRewrites(options.publicPath, options.pages)
            },
            hot: !isProduction
          },
          projectDevServerOptions,
          {
            host,
            port,
            https: useHttps,
            proxy: proxySettings,

            static: {
              directory: api.resolve('public'),
              publicPath: options.publicPath,
              watch: !isProduction,

              ...(projectDevServerOptions.static as Record<string,any>)
            },

            client: {
              webSocketURL,

              logging: 'none',
              overlay: isProduction // TODO disable this
                ? false
                : { warnings: false, errors: true },
              progress: !process.env.VUE_CLI_TEST,

              ...(projectDevServerOptions.static as Record<string,any>)
            },

            open: args.open || projectDevServerOptions.open,
            setupExitSignals: true,

            setupMiddlewares(middlewares, devServer) {
              // launch editor support.
              // this works with vue-devtools & @vue/cli-overlay
              devServer.app.use(
                '/__open-in-editor',
                launchEditorMiddleware(() =>
                  console.log(
                    `To specify an editor, specify the EDITOR env variable or ` + `add "editor" field to your Vue project config.\n`
                  )
                )
              )

              // allow other plugins to register middlewares, e.g. PWA
              // todo: migrate to the new API interface
              api.service.devServerConfigFns.forEach((fn) => fn(devServer.app, devServer))

              if (projectDevServerOptions.setupMiddlewares) {
                return projectDevServerOptions.setupMiddlewares(middlewares, devServer)
              }

              return middlewares
            }
          }
        ),
        compiler
      )

      if (args.stdin) {
        process.stdin.on('end', () => {
          server.stopCallback(() => {
            process.exit(0)
          })
        })

        process.stdin.resume()
      }

      // on appveyor, killing the process with SIGTERM causes execa to
      // throw error
      if (process.env.VUE_CLI_TEST) {
        process.stdin.on('data', (data) => {
          if (data.toString() === 'close') {
            console.log('got close signal!')
            server.stopCallback(() => {
              process.exit(0)
            })
          }
        })
      }

      return new Promise((resolve, reject) => {
        // log instructions & open browser on first compilation complete
        let isFirstCompile = true
        compiler.hooks.done.tap('vue-cli-service serve', (stats) => {
          if (stats.hasErrors()) {
            return
          }

          let copied = ''
          if (isFirstCompile && args.copy) {
            try {
              require('clipboardy').writeSync(localUrlForBrowser)
              copied = chalk.dim('(copied to clipboard)')
            } catch (_) {
              /* catch exception if copy to clipboard isn't supported (e.g. WSL), see issue #3476 */
            }
          }

          const networkUrl = publicUrl ? publicUrl.replace(/([^/])$/, '$1/') : urls.lanUrlForTerminal

          console.log()
          console.log(`  App running at:`)
          console.log(`  - Local:   ${chalk.cyan(urls.localUrlForTerminal)} ${copied}`)
          if (!isInContainer) {
            console.log(`  - Network: ${chalk.cyan(networkUrl)}`)
          } else {
            console.log()
            console.log(chalk.yellow(`  It seems you are running Vue CLI inside a container.`))
            if (!publicUrl && options.publicPath && options.publicPath !== '/') {
              console.log()
              console.log(chalk.yellow(`  Since you are using a non-root publicPath, the hot-reload socket`))
              console.log(chalk.yellow(`  will not be able to infer the correct URL to connect. You should`))
              console.log(chalk.yellow(`  explicitly specify the URL via ${chalk.blue(`devServer.public`)}.`))
              console.log()
            }
            console.log(
              chalk.yellow(
                `  Access the dev server via ${chalk.cyan(
                  `${protocol}://localhost:<your container's external mapped port>${options.publicPath}`
                )}`
              )
            )
          }
          console.log()

          if (isFirstCompile) {
            isFirstCompile = false

            if (!isProduction) {
              const buildCommand = hasProjectYarn(api.getCwd())
                ? `yarn build`
                : hasProjectPnpm(api.getCwd())
                ? `pnpm run build`
                : `npm run build`
              console.log(`  Note that the development build is not optimized.`)
              console.log(`  To create a production build, run ${chalk.cyan(buildCommand)}.`)
            } else {
              console.log(`  App is served in production mode.`)
              console.log(`  Note this is for preview or E2E testing only.`)
            }
            console.log()

            // Send final app URL
            if (args.dashboard) {
              const ipc = new IpcMessenger()
              ipc.send({
                vueServe: {
                  url: localUrlForBrowser
                }
              })
            }

            // resolve returned Promise
            // so other commands can do api.service.run('serve').then(...)
            resolve({
              server,
              url: localUrlForBrowser
            })
          } else if (process.env.VUE_CLI_TEST) {
            // signal for test to check HMR
            console.log('App updated')
          }
        })

        server.start().catch((err) => reject(err))
      })
    }
  )
}

// https://stackoverflow.com/a/20012536
function checkInContainer() {
  if ('CODESANDBOX_SSE' in process.env) {
    return true
  }
  const fs = require('fs')
  if (fs.existsSync(`/proc/1/cgroup`)) {
    const content = fs.readFileSync(`/proc/1/cgroup`, 'utf-8')
    return /:\/(lxc|docker|kubepods(\.slice)?)\//.test(content)
  }
}

function genHistoryApiFallbackRewrites(baseUrl, pages = {}) {
  const path = require('path')
  const multiPageRewrites = Object.keys(pages)
    // sort by length in reversed order to avoid overrides
    // eg. 'page11' should appear in front of 'page1'
    .sort((a, b) => b.length - a.length)
    .map((name) => ({
      from: new RegExp(`^/${name}`),
      to: path.posix.join(baseUrl, pages[name].filename || `${name}.html`)
    }))
  return [...multiPageRewrites, { from: /./, to: path.posix.join(baseUrl, 'index.html') }]
}

module.exports.defaultModes = {
  'serve:mfsu': 'development'
}
