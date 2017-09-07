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