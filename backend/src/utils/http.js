class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const idOf = (ref) => String(ref?._id || ref);

const isOwnerOrAdmin = (user, ownerRef) =>
  Boolean(user) && (user.role === 'admin' || idOf(ownerRef) === String(user._id));

module.exports = { HttpError, escapeRegex, idOf, isOwnerOrAdmin };
