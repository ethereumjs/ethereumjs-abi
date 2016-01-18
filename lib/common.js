require('es6-shim');
const utils = require('ethereumjs-util');

// Convert from short to canonical names
// FIXME: optimise or make this nicer?
module.exports.elementaryName = function(name) {
  if (name.startsWith('int['))
    return 'int256' + name.slice(4);
  else if (name === 'int')
    return 'int256';
  if (name.startsWith('uint['))
    return 'uint256' + name.slice(4);
  else if (name === 'uint')
    return 'uint256';
  else if (name.startsWith('real['))
    return 'real128x128' + name.slice(4);
  else if (name === 'real')
    return 'real128x128';
  else if (name.startsWith('ureal['))
    return 'ureal128x128' + name.slice(4);
  else if (name === 'ureal')
    return 'ureal128x128';
  return name;
};

module.exports.methodID = function(name, types) {
  return this.eventID(name, types).slice(0, 4);
};

module.exports.eventID = function(name, types) {
  // FIXME: use node.js util.format?
  var sig = name + '(' + types.map(this.elementaryName).join(',') + ')';
  return utils.sha3(new Buffer(sig));
};
