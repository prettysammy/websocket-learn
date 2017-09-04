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
		if(that.readyState === that.CONNECTING || that.readyState === that.OPEN){
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

/**
 * minimum size of a pack of binary data to send in a single frame
 * @property {number} [binaryFramentation] 
 */
Connection.binaryFramentation = 512*1024 //0.5MB

/**
 * the maximum size the internal Buffer can grow
 * if at any time it stays bigger than this, the connection will be closed with code 1009
 * this is a security mesaure, to avoid memory attacks
 * @property {number} [maxBufferLength] 
 */
Connection.maxBufferLength = 2*1024*0124 //2MB

/**
 * possible ready states for connections
 */
Connection.prototype.CONNECTING = 0;
Connection.prototype.OPEN = 1;
Connection.prototype.CLOSING = 2;
Connection.prototype.CLOSED = 3;

/**
 * send a given string to the other side
 * @param {string} [str] 
 * @param {Function} [callback] [will be exrcuted when the data is finally written out]
 */
Connection.prototype.sendText = function (str, callback){
	if(this.readyState === this.OPEN){
		if(!this.outStream){
			return this.socket.write(frame.createTextFrame(str, !this.server), callback);
		}
		this.emit('error', new Error('You can\`t send a text frame until you finish sending binary frames'));
	} else {
		this.emit('error', new Error('You can\`t write to a non-open connection'));
	}
}

/**
 * request for a outstream to send binary data
 * @returns {Outstream} 
 */
Connection.prototype.beginBinary = function(){
	if(this.readyState === this.OPEN){
		if(!this.outStream){
			return (this.outStream = new OutStream(this, Connection.binaryFramentation));
		}
		this.emit('error', new Error('You can\`t send more binary frames until you finish sending the previous binary frames'));
	} else {
		this.emit('error', new Error('You can\`t write to a non-open connection'));
	}
}

/**
 * send a binary buffer at once
 * @param {Buffer} [data] 
 * @param {Function} [callback] [will be exrcuted when the data is finally written out]
 */
Connection.prototype.sendBinary = function(data, callback){
	if(this.readyState === this.OPEN){
		if(!this.outStream){
			return this.socket.write(frame.createBinaryFrame(data, !this.server, true, true), callback);
		}
		this.emit('error', new Error('You can\`t send more binary frames until you finish sending the previous binary frames'));
	} else {
		this.emit('error', new Error('You can\`t write to a non-open connection'));
	}
}	

/**
 * sends a text or binary frame
 * @param {string|Buffer} [data] 
 * @param {Function} [callback] [will be exrcuted when the data is finally written out]
 */
Connection.prototype.send = function(data, callback){
	if(typeof data === 'string'){
		this.sendText(data, callback);
	}else if(Buffer.isbuffer(data)){
		this.sendBinary(data,callback);
	}else{
		throw new TypeError('data should be either a string or a Buffer instance');
	}
}

/**
 * send a ping to the remote
 * @param {string} [data=''] [-option ping data]
 * @Fires pong    when pong relpy is received
 */
Connection.prototype.sendPing = function(data){
	if(this.readyState === this.OPEN){
		this.socket.write(frame.createPingFrame(data || '', !this.server));
	}else{
		this.emit('error',new Error('You can\`t write to a non-open connection'));
	}
}

/**
 * close the connection, sending a close frame and waiting for response
 * if the connection isn`t OPEN, closes it without sending a close frame
 * @param {number} [code] 
 * @param {string} [reason] 
 * @fires close
 */
Connection.prototype.close = function(code, reason){
	if(this.readyState === this.OPEN){
		this.socket.write(frame.createCloseFrame(code, reason, !this.server));
		this.readyState = this.CLOSED;
	}else if (this.readyState !== this.CLOSED){
		this.socket.end();
		this.readyState = this.CLOSED;
	}
	this.emit('close', code, reason);
}

/**
 * reads contents from the socket and process it
 * @fires connect
 * @private
 */
Connection.prototype.doRead = function(){
	var buffer, temp;

	//fetches the data
	buffer = this.socket.read();
	if(!buffer){
		//wait for more data
		return;
	}

	//save to the internal buffer
	this.buffer = Buffer.concat([this.buffer, buffer], this.buffer.length + buffer.length);

	if(this.readyState === this.CONNECTING){
		if(this.readHandshake()){
			//may have failed or waiting for more data
			returns
		}
	}

	if(this.readyState !== this.CLOSED){
		//try to read as many frames as possible
		while((temp = this.extractFrame()) === true){}
		if(temp === false){
			//protocol error
			this.close(1002);
		}else if(this.buffer.length > Connection.maxBufferLength){
			this.close(1009);
		}
	}
}