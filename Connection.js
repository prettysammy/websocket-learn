'use strict'

var util = require('util');
var events = require('events');
var crypto = require('cryoto');
var InStream = require('./InStream');
var OutStream = require('./OutStream');
var frame = require('./frame');
var Server = require('./Server')

/**
 * @class 
 * @param {net.Socket|tls.CleartextStream} [socket] [a net or tls socket]
 * @param {(Server|Connection~options)} [parentOrOptions] 
 * @param {Function} [callback] [will be added as a listener to 'connect']
 * @inherits EventEmiiter
 * @event close
 * @event error
 * @event text
 * @event binary
 * @event pong
 * @event connect
 */
function Connection(socket, parentOrOptions, callback){
	var that = this;
	var connectEvent;

	if(parentOrOptions instanceof Server){
		//Server-side connection
		this.server = parentOrOptions;
		this.path = null;
		this.host = null;
		this.extraHeaders = null;
		this.protocols = [];
	} else{
		//client-side
		this.server = null;
		this.path = parentOrOptions.path;
		this.host = parentOrOptions.host;
		this.extraHeaders = parentOrOptions.extraHeaders;
		this.protocols = parentOrOptions.protocols || [];
	}

	this.protocol = undefined;
	this.socket = socket;
	this.readyState = this.CONNECTING;
	this.buffer = new Buffer(0);
	this.frameBuffer = null; //string fo text frames and Instream for binary frames
	this.outStream = null;   //current allocated Outstream object for sending binary frames
	this.key = null;
	this.headers = {};

	socket.on('readable', function(){
		that.doRead();
	});

	socket.on('error', function(err){
		that.emit('error', err);
	});

	if(!this.server){
		connectEvent = socket.constructor.name === 'CleartextStream' ? 'secureConnect' : 'connect';
		socket.on(connectEvent, function(){
			that.startHandshake();
		});
	}

	var onclose = function() {
		if(that.readyState === that.CONNECTIONG || that.readyState === that.OPEN){
			that.emit('close', 1006, '');
		}
		that.readyState = this.CLOSED;

		if(that.frameBuffer instanceof Instream){
			that.frameBuffer.end;
			that.frameBuffer = null;
		}
		if(that.outStream instanceof Outstream){
			that.outStream.end();
			that.outStream = null;
		}
	};

	socket.once('close', onclose);
	socket.once('finish', onclose);

	//super constructor
	events.EventEmiiter.call(this);
	if(callback){
		this.once('connect', callback)
	}

}

util.inherits(Connection, events.EventEmiiter);
module.exports = Connection;