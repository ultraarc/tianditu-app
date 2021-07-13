module.exports = {
  lintOnSave: false, // 打包过程不因为lint错误而中断
  publicPath: "./",
  chainWebpack: (config) => {},
};

// module.exports = {
//   //配置加载md文件时的解析规则
//    chainWebpack: config => {
//     config.module
//       .rule('md')
//       .test(/\.md/)
//       .use('html-loader')
//       .loader('html-loader')
//       .end()
//       .use('markdown-loader')
//       .loader('markdown-loader')
//       .end()
//   }
// }
