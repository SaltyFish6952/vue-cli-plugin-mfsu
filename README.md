# vue-cli-plugin-mfsu
vue-cli support mfsu

## è¦æ± requires
ð  `Vue CLI` version `v5.x` (support `Webpack 5`)

## æè·¯ ideas
1. `vue-cli`æ²¡ææ´é²è¿å¤ç`hooks`å»è¿è¡èªå®ä¹çæä½ï¼å æ­¤éè¦ä¿®æ¹(copy)`cli-service serve`è¿è¡`Module Federation`çæä½æ³¨å¥ã
2. `vue-cli`é»è®¤çæç`babel`éç½®é¡¹`@vue/cli-plugin-babel/preset`ï¼éè¦è®¾ç½®`@babel/preset-env`çåæ°ï¼`{useBuiltIns: false}`ä»¥å³é­èªå¨æ³¨å¥ç`polyfill`ï¼ä»¥é¿å`MF`çæèªå¨æ³¨å¥çä¾èµãåèï¼[Babel](https://babeljs.io/docs/en/babel-preset-env#usebuiltins-false) [@vue/cli-plugin-babel/preset](https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/babel-preset-app)
3. ä¸äº`babel`å¨æè¯­æ³çæä»¶ä¹æå¯è½ä¼é æå²çªï¼å¦`babel-plugin-dynamic-import-node`ã

## æä»¶ plugins
1. @umijs/mfsu (å½åä½¿ç¨) [Github](https://github.com/umijs/umi-next/tree/master/packages/mfsu) [ä½¿ç¨ææ¡£](https://github.com/umijs/umi-next/blob/master/docs/blog/mfsu-independent-usage.md)
2. alibaba/ice ä¸éç¨ï¼éé­æ¹æ¯ævue [Github](https://github.com/alibaba/ice/blob/master/packages/plugin-react-app/src/userConfig/remoteRuntime/index.ts) [éç½®è¯´æ](https://ice.work/docs/guide/advanced/pre-compile)
