'use strict'

var Server = require('./Server');
var Connection = require('./Connection');
var net = require('net');
var tls = require('tls');
var url = require('url');

/**
 * create a websocket server
 * @param {Object} [options] [will be passed to net.createServer() or tls.createServer(), whit the additional property 'secure']
 * @param {Function} [callback] [will be added as 'connection' listener]
 * @returns {Server} 
 */
export.createServer = function(options, callback){
	if(typeof options === 'function' || !arguments.length){
		return new Server(false, options);
	}

	return new Server(Boolean(options.secure), options, callback);
}

/**
 * create a websocket client
 * @param {string} [url] [with the format 'ws://localhost:8000/chat']
 * @param {Object} [options] [will be passed to net.connect() or tls.connect()]
 * @param {Function} [callback] [will be added as 'connect' listener]
 * @returns {Connection} 
 */
exports.connect = function(URL, options, callback){
	var socket;

	if(typeof options === 'function'){
		callback = options;
		options = undefined;
	}
	options = options || {};

	var connectionOptions = parseWSURL(URL);
	options.port = connectionOptions.port;
	options.host = connectionOptions.host;

	connectionOptions.extraHeaders = options.extraHeaders;
	connectionOptions.protocols = options.protocols;

	if(connectionOptions.secure){
		socket = tls.connect(optins);
	}else{
		socket = net.connect(options);
	}

	return new Connection(socket, connectionOptions, callback);
}

/**
 * set the minimun size of a pack of binary data to send in a single frame
 * @param {number} [bytes] 
 */
exports.setBinaryFragmentation = function(bytes){
	Connection.binaryFramentation = bytes;
}

/**
 * set the maximum size the internal buffer can grow, to avoid memory attacks
 * @param {number} [bytes] 
 */
exports.setMaxBufferLength = function(bytes){
	Connection.maxBufferLength = bytes;
}

/**
 * parse the websocket URL
 * @param {string} [URL] 
 * @returns {Object} 
 * @private
 */
function parseWSURL(URL){
	var parts,secure;

	parts = url.parse(URL);

	parts.protocol = parts.protocol || 'ws:';
	if(parts.protocol === 'ws:'){
		secure = false;
	}else if(parts.protocol === 'wss:'){
		secure = true;
	}else{
		throw new Error('Invaild protocol' + parts.protocol + '. It must be ws or wss');
	}

	parts.port = parts.port || (secure ? 443 : 80);
	parts.path = parts.path || '/';

	return {
		path: parts.path,
		port: parts.port,
		secure: secure,
		host: parts.hostname
	}
}