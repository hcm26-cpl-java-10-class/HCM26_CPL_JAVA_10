// Running route files
const { readdirSync, lstatSync } = require("fs");
const path = require("path");
(function runRoutesRecursive(dir) {
  readdirSync(dir).forEach((file) => {
    file = path.resolve(dir, file);
    if(lstatSync(file).isDirectory()) return runRoutesRecursive(file);
    require(file);
  })
})("routes");