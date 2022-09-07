# vue-cli-plugin-mfsu
vue-cli support mfsu

## 要求 requires
🛠 `Vue CLI` version `v5.x` (support `Webpack 5`)

## 思路 ideas
1. `vue-cli`没有暴露过多的`hooks`去进行自定义的操作，因此需要修改(copy)`cli-service serve`进行`Module Federation`的操作注入。
2. `vue-cli`默认生成的`babel`配置项`@vue/cli-plugin-babel/preset`，需要设置`@babel/preset-env`的参数：`{useBuiltIns: false}`以关闭自动注入的`polyfill`，以避免`MF`生成自动注入的依赖。参考：[Babel](https://babeljs.io/docs/en/babel-preset-env#usebuiltins-false) [@vue/cli-plugin-babel/preset](https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/babel-preset-app)
3. 一些`babel`动态语法的插件也有可能会造成冲突，如`babel-plugin-dynamic-import-node`。

## 插件 plugins
1. @umijs/mfsu (当前使用) [Github](https://github.com/umijs/umi-next/tree/master/packages/mfsu) [使用文档](https://github.com/umijs/umi-next/blob/master/docs/blog/mfsu-independent-usage.md)
2. alibaba/ice 不通用，需魔改支持vue [Github](https://github.com/alibaba/ice/blob/master/packages/plugin-react-app/src/userConfig/remoteRuntime/index.ts) [配置说明](https://ice.work/docs/guide/advanced/pre-compile)

## 安装 install
1. 检查 `Vue CLI` 版本，见 [升级 Vue CLI 服务及插件](https://cli.vuejs.org/zh/guide/installation.html#%E9%A1%B9%E7%9B%AE%E4%BE%9D%E8%B5%96) 

2. 🔨 安装本项目
    ```bash
    yarn add vue-cli-plugin-mfsu -D
    ```

3. 🔨 安装 `patch-package`
    ```bash
    yarn add patch-package -D
    ```

4. 🛠 打补丁以支持 `@umijs/mfsu`
 - @umijs/bundler-esbuild/dist/plugins/style.js
    ```patch
    diff --git a/node_modules/@umijs/bundler-esbuild/dist/build.js b/node_modules/@umijs/bundler-esbuild/dist/build.js
    index e318be8..9a72666 100644
    --- a/node_modules/@umijs/bundler-esbuild/dist/build.js
    +++ b/node_modules/@umijs/bundler-esbuild/dist/build.js
    @@ -54,6 +54,7 @@ async function build(opts) {
    return await (0, import_esbuild.build)({
        entryPoints: opts.entry,
        bundle: true,
    +    banner: { js: '"use strict";' },
        format: opts.format || "iife",
        logLevel: "error",
        sourcemap: opts.sourcemap,
    ```
 - @umijs/mfsu/dist/loader/esbuild.js
    ```patch
    diff --git a/node_modules/@umijs/mfsu/dist/loader/esbuild.js b/node_modules/@umijs/mfsu/dist/loader/esbuild.js
    index a5b0c61..d648218 100644
    --- a/node_modules/@umijs/mfsu/dist/loader/esbuild.js
    +++ b/node_modules/@umijs/mfsu/dist/loader/esbuild.js
    @@ -64,7 +64,7 @@ async function esbuildTranspiler(source) {
    const ext = (0, import_path.extname)(filePath).slice(1);
    const transformOptions = __spreadProps(__spreadValues({}, otherOptions), {
        target: options.target ?? "es2015",
    -    loader: ext ?? "js",
    +    loader: ext !== null && ext !== void 0 ? ext === 'vue' ? 'ts' : ext : 'js',
        sourcemap: this.sourceMap,
        sourcefile: filePath
    });
    ```
4. 🛠 更改配置 `babel.config.js`
    ```javascript

    module.exports = {
        presets: ['@vue/cli-plugin-babel/preset'],
        env: {
            development: {
            presets: [['@vue/cli-plugin-babel/preset', { useBuiltIns: false, targets: { chrome: 100 } }]]
            }
        }
    }
    ```
5. ⚡️ 运行 `mfsu`
    ```bash
    vue-cli-service serve:mfsu
    ```


