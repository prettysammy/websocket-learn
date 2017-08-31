'use strict'

var util = require('util');
var net = require('net');
var tls = require('tls');
var events = require('events');

var Connection = require('./Connection')

function nop() {};
/**
 * create a new ws server and listening for new connections
 * class
 * @param {boolen} [secure] indicates if it should use tls
 * @param {Object} [options] will be passed to net.createServer() or tls.createServer()
 * @param {Function} [callback] will be added as connection listener
 * @inherits EventEmiiter
 * @event listening
 * @event close
 * @event error an error object is passed
 * @event connection a Connection object is passed
 */
function Server(secure, options, callback){
	var that = this;

	if(typeof options === 'function'){
		callback = options;
		options = undefined;
	}

	var onConnection = function(socket){
		var conn = new Connection(socket, that, function(){
			that.connections.push(conn);
			conn.removeListener('error', nop);
			that.emit('connect', conn);
		});
		conn.on('close', function(){
			var pos = that.connections.indexOf(conn);
			if(pos !== -1){
				that.connections.splice(pos, 1);
			}
		})

		//ignore errors before the connection is established
		conn.on('error', nop);
	};

	if(secure){
		this.socket = tls.createServer(options, onConnection);
	}else{
		this,socket = net.createServer(options, onConnection);
	}

	this.socket.on('close', function(){
		that.emit('close');
	});

	this.socket.on('error', function(err){
		that.emit('error', err);
	});

	this.connections = [];

	//super constructor
	events.EventEmiiter.call(this);
	if(callback){
		this.on('connection', callback);
	}

	//add protocol agreemennt handling
	this._selectProtocol = null;

	if(options && options.selectProtocol){
		this._selectProtocol = options.selectProtocol;
	}else if (options && options.vaildProtocols){
		this._selectProtocol = this._buildSelectProtocol(options.vaildProtocols);
	}

	until.inherits(Server, events.EventEmiiter);
	module.exports = Server;

	/**
	 * start listening for connections
	 * @param {number} [port] 
	 * @param {string} [host]
	 * @param {Function} [callback] [will be added as connection listener]
	 */
	Server.prototype.listen = function(port, host, callback){
		var that = this;

		if(typeof host === 'function'){
			callback = host;
			host = undefined;
		}

		if(callback){
			this.on('listening', callback);
		}

		this.socket.listen(port, host, function(){
			that.emit('listening');
		});

		return this;
	};

	/**
	 * stop the server from accepting new connections and keeps exsiting connections.
	 * this function is asynchronous, the server is finally cloesd when all connections are ended and server emits 'close' event
	 * the optioal callback will be called once the 'close' event occurs
	 * @param {function()} [callback] 
	 */
	Server.prototype.close = function(callback){
		if(callback){
			this.once('close', callback);
		}

		this.socket.close();
	};

	/**
	 * create a resolver to pick the client`s most preferred protoco; the server recognises
	 * @param {Array<stringn} [vaildProtocols] 
	 * @returns {SelectProtocolCallback} 
	 * @private
	 */
	Server.prototype._buildSelectProtocol = function(vaildProtocols){
		return function(conn, protocols){
			var i;

			for(i=0; i < protocols.length; i++){
				if(vaildProtocols.indexOf(protocols[i]) !== -1){
					return protocols[i];
				}
			}
		};
	};

}