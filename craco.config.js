// craco.config.js
const fs = require("fs");
const evalSourceMapMiddleware = require("react-dev-utils/evalSourceMapMiddleware");
const noopServiceWorkerMiddleware = require("react-dev-utils/noopServiceWorkerMiddleware");
const redirectServedPath = require("react-dev-utils/redirectServedPathMiddleware");
const paths = require("react-scripts/config/paths");

module.exports = {
  devServer: (devServerConfig) => {
    // Replace deprecated hooks with setupMiddlewares
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      if (!devServer) {
        throw new Error("webpack-dev-server is not defined");
      }

      // Old onBeforeSetupMiddleware
      devServer.app.use(evalSourceMapMiddleware(devServer));
      if (fs.existsSync(paths.proxySetup)) {
        require(paths.proxySetup)(devServer.app);
      }

      // Old onAfterSetupMiddleware
      devServer.app.use(redirectServedPath(paths.publicUrlOrPath));
      devServer.app.use(noopServiceWorkerMiddleware(paths.publicUrlOrPath));

      return middlewares;
    };

    return devServerConfig;
  },
};
