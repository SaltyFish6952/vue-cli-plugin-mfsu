const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  pluginOptions: {
    mfsu: {
      unMatchLibs: [
        // mfsu扫描不匹配某些包，以下包是webpack-dev-server 添加的
        // mfsu unmatch some packages, packages below are added by webpack-dev-server
        "ansi-html-community",
        "html-entities",
        new RegExp(/^webpack/g),
        // 以下包是 core-js 做polyfill的时候追加的，建议在babel.config.js 中禁用polyfill
        // packages below are added by core-js when runtime polyfilled, disabled polyfill is recommended in babel.config.js
        new RegExp(/^core-js/g),
      ],
    },
  },
});
