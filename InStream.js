'use strict'

var util = require('util');
var stream = require('stream');

/**
 * represents the readables stream for binary frames
 * @class 
 * @event readable
 * @event end
 */
function InStream(){
	stream.Readable.call(this);
};

module.exports = InStream;

util.inherits(InStream, stream.Readable);

/**
 * @private
 */
InStream.prototype._read = function() {};

/**
 * add more data to the stream and fires "readable" event
 * @param {Buffer} [data] 
 * @private
 */
InStream.prototype.addData = function(data){
	this.push(data);
};

/**
 * Indicates there is on more data to add to stream
 * @private
 */
InStream.prototype.end = function(){
	this.push(null);
};