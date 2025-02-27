"use strict";

console.log("Welcome to LaTeX for Gmail!");

let DEFAULT_FORMAT = 'plain';

var ports = {};
var pdftexWorkerPool;
var mupdfWorkerPool;

function setupWorkerPools() {
  setupPdftexWorkerPool({ count: 2, multiplier: 1 });
  setupMupdfWorkerPool({ count: 1, multiplier: 4 });
}

function getStatus() {
  return {
    code: Communicator.SUCCESS,
    payload: {
      pdftexWorkerPool: {
        destroyed: pdftexWorkerPool.destroyed,
        count: pdftexWorkerPool.realPool.length,
        multiplier: pdftexWorkerPool.multiplier
      },
      mupdfWorkerPool: {
        destroyed: mupdfWorkerPool.destroyed,
        count: mupdfWorkerPool.realPool.length,
        multiplier: mupdfWorkerPool.multiplier
      }
    }
  }
}

function setupPdftexWorkerPool({ count, multiplier }) {
  pdftexWorkerPool = new Pool({
    name: "pdftexWorkerPool",
    count: count,
    cons: () => new Communicator(new Worker('pdftexworker.js', { 'name': `pdftexworker-${random_id(16)}` })),
    free: comm => comm.target.terminate(),
    autoRelease: true,
    initialize: () => { },
    multiplier: multiplier
  });
}

function setupMupdfWorkerPool({ count, multiplier }) {
  mupdfWorkerPool = new Pool({
    name: "mupdfWorkerPool",
    count: count,
    cons: () => new Communicator(new Worker('mupdfworker.js', { 'name': `mupdfworker-${random_id(16)}` })),
    free: comm => comm.target.terminate(),
    autoRelease: true,
    initialize: () => { },
    multiplier: multiplier
  });
}

function destroyPdftexWorkerPool() {
  pdftexWorkerPool.destroy();
}

function destroyMupdfWorkerPool() {
  mupdfWorkerPool.destroy();
}

async function compile(srcCode, params) {
  params = params ? params : [];
  let res = await pdftexWorkerPool.process(comm =>
    comm.request(
      "compile",
      { srcCode: srcCode, params: params })
  );
  return res.pdfFile;
}

async function compileSnippet(snippet, formatName) {
  formatName = formatName ? formatName : DEFAULT_FORMAT;

  let res = await pdftexWorkerPool.process(comm =>
    comm.request(
      "compileSnippet",
      { snippet: snippet, formatName: formatName })
  );
  return res.pdfFile;
}

// pdfFile is an Uint8Array
async function pdf2png(pdfFile, scale, pageNo, alpha) {
  alpha = alpha ? alpha : 0;
  let res = await mupdfWorkerPool.process(comm =>
    comm.request(
      "pdf2png",
      { pdfFile: pdfFile, scale: scale, pageNo: pageNo, alpha: alpha },
      [pdfFile.buffer])
  );
  return res.pngFile;
}

async function compile2png(srcCode, scale, params, alpha) {
  let pdfFile = await compile(srcCode, params);
  let pngFile = await pdf2png(pdfFile, scale, 1, alpha);
  return new Uint8Array(pngFile);
}

async function compileSnippet2png(snippet, formatName, scale, alpha) {
  let pdfFile = await compileSnippet(snippet, formatName);
  let pngFile = await pdf2png(pdfFile, scale, 1, alpha);
  return new Uint8Array(pngFile);
}

async function toUrlFactory(f, tpe) {
  let file = await f();
  let blob = new Blob([file], { type: tpe });
  let url = URL.createObjectURL(blob);

  setTimeout(() => URL.revokeObjectURL(url), 10000); // Automatically free after 10 seconds to avoid leaks.
  return {
    code: Communicator.SUCCESS,
    payload: { url: url }
  };
}

async function compile2pngURL({ srcCode, scale, params, alpha }) {
  return toUrlFactory(() => compile2png(srcCode, scale, params, alpha), 'image/png');
}

async function compile2pdfURL({ srcCode, params }) {
  return toUrlFactory(() => compile(srcCode, params), 'application/pdf');
}

async function compileSnippet2pngURL({ snippet, formatName, scale, alpha }) {
  return toUrlFactory(() => compileSnippet2png(snippet, formatName, scale, alpha), 'image/png');
}

async function compileSnippet2pdfURL({ snippet, formatName }) {
  return toUrlFactory(() => compileSnippet(snippet, formatName), 'application/pdf');
}


function revokeUrl({ url }) {
  URL.revokeObjectURL(url);
}

function setupMessageHandler(comm) {
  comm.messageHandler.getStatus = getStatus;
  comm.messageHandler.setupPdftexWorkerPool = setupPdftexWorkerPool;
  comm.messageHandler.setupMupdfWorkerPool = setupMupdfWorkerPool
  comm.messageHandler.destroyPdftexWorkerPool = destroyPdftexWorkerPool;
  comm.messageHandler.destroyMupdfWorkerPool = destroyMupdfWorkerPool;
  comm.messageHandler.compile2pngURL = compile2pngURL;
  comm.messageHandler.compile2pdfURL = compile2pdfURL;
  comm.messageHandler.compileSnippet2pngURL = compileSnippet2pngURL;
  comm.messageHandler.compileSnippet2pdfURL = compileSnippet2pdfURL;
  comm.messageHandler.revokeUrl = revokeUrl;
}

chrome.runtime.onConnect.addListener(function (port) {
  let comm = new Communicator(new PortWrapper(port));
  ports[port.name] = comm;
  setupMessageHandler(comm);

  port.onDisconnect.addListener(function () {
    delete ports[port.name];
  });
});

setupWorkerPools()