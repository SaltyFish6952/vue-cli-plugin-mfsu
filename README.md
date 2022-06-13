# vue-cli-plugin-mfsu
vue-cli support mfsu

## 思路
1. `vue-cli`没有暴露过多的`hooks`去进行自定义的操作，因此需要修改(copy)`cli-service serve`进行`Module Federation`的操作注入。
2. `vue-cli`默认生成的`babel`配置项`@vue/cli-plugin-babel/preset`，可能会与MF插件冲突，需要配置。
3. 冲突主要有2点：`polyfill`和一些`babel`动态语法的插件。

## 插件
1. @umijs/mfsu (当前使用) [Github](https://github.com/umijs/umi-next/tree/master/packages/mfsu) [使用文档](https://github.com/umijs/umi-next/blob/master/docs/blog/mfsu-independent-usage.md)
2. alibaba/ice 不通用，需魔改支持vue [Github](https://github.com/alibaba/ice/blob/master/packages/plugin-react-app/src/userConfig/remoteRuntime/index.ts) [配置说明](https://ice.work/docs/guide/advanced/pre-compile)
