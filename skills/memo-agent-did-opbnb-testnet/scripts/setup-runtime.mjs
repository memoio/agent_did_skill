#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillDirectory=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const json=process.argv.includes("--json");
const [major,minor]=process.versions.node.split(".").map(Number);

function report(payload){
  process.stdout.write(json?`${JSON.stringify(payload)}\n`:`${payload.ready?"运行依赖已就绪；尚未创建 DID。":"运行依赖准备失败："+payload.error.code}\n`);
}

if(major<22||(major===22&&minor<5)){
  report({ready:false,error:{code:"NODE_VERSION_UNSUPPORTED",message:"需要 Node.js 22.5.0 或更新版本"}});
  process.exitCode=1;
}else{
  const result=spawnSync("npm",["ci","--omit=dev","--ignore-scripts","--no-audit","--no-fund"],{
    cwd:skillDirectory,encoding:"utf8",timeout:120_000,
  });
  if(result.error||result.status!==0){
    report({ready:false,error:{code:"RUNTIME_DEPENDENCY_INSTALL_FAILED",message:"npm ci 未完成；请检查 npm registry 连接与安装目录权限"}});
    process.exitCode=1;
  }else{
    report({ready:true,generatedIdentity:false,next:"node bin/memo-agent-opbnb-testnet config check"});
  }
}
