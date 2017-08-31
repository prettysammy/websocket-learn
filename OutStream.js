'use strict'

var util = require('util');
var stream = require('stream');
var frame = require('frame');

/**
 * @class  Represets the writabe stream for binary frames
 * @param {Connection} [connection] 
 * @param {number} [minSize] 
 */
function OutStream(connection, minSize){
	var that = this;
	this.connection = connection;
	this.minSize = minSize;
	this.buffer = new Buffer(0);
	this.hasSent = false;

	stream.Writable.call(this);

	this.on('finish', function(){
		if(that.connection.readyState === that.connection.OPEN){
			//ignore if not connected anymore
			that.connection.socket.write(frame.createBinaryFrame(that.buffer, !that.connection.server, !that.hasSent, true))
		}
		that.connection.outStream = null;
	})
};

module.exports = OutStream;

util.inherits(OutStream,stream.Writable);

/**
 * @param {Buffer} [chunk] 
 * @param {strign} [encoding] 
 * @param {Function} [callback] 
 */
OutStream.prototype._write = function(chunk, encoding, callback){
	var frameBuffer;

	this.buffer = Buffer.concat([this.buffer,chunk], this.buffer.legth + chunk.legth);
	if(this.buffer.length >= this.minSize){
		if(this.connection.readyState == this.connection.OPEN){
			//ignore if not connected anymore
			frameBuffer = frame.createBinaryFrame(this.buffer, !this.connection.server, !this.hasSent, false);
			this.connection.socket.write(frameBuffer, encoding, callback);
		}
		this.buffer = new Buffer(0);
		this.hasSent = true;
		if(this.connection.readyState !== this.connection.OPEN){
			callback();
		}
	}else{
		callback();
	}
}