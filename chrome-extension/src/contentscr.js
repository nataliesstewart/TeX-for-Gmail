"use strict";

let port = chrome.runtime.connect({ name: `${random_id(64)}` });
let comm = new Communicator(new PortWrapper(port));

async function getBackgroundPageStatus() {
  return comm.request("getStatus", {});
}

async function receiveUrl(req) {
  let res = await req();
  let f = await fetch(res.url);
  let blob = await f.blob()
  let url = URL.createObjectURL(blob)
  comm.post("revokeUrl", { url: res.url });
  return url;
}

async function compile2pngURL(srcCode, scale, params, alpha) {
  return receiveUrl(() =>
    comm.request("compile2pngURL", { srcCode: srcCode, scale: scale, params: params, alpha: alpha })
  );
}

async function compile2pdfURL(srcCode, params) {
  return receiveUrl(() =>
    comm.request("compile2pdfURL", { srcCode: srcCode, params: params })
  );
}

async function compileSnippet2pngURL(snippet, formatName, scale, alpha) {
  return receiveUrl(() =>
    comm.request("compileSnippet2pngURL", { snippet: snippet, formatName: formatName, scale: scale, alpha: alpha })
  );
}

async function compileSnippet2pdfURL(snippet, formatName) {
  return receiveUrl(() => comm.request("compileSnippet2pdfURL", { snippet: snippet, formatName: formatName }));
}

// compile2pngURL("\\documentclass{article}\\begin{document}Test222\\end{document}", 2).then(res => console.log(res));

// compileSnippet2pngURL(String.raw`$H^*(\Gamma, \mathcal{G}_2)$`, 'myPreamble', 3, 0).then(res => console.log(res))