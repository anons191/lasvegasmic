module.exports = function (req, res, next) {
  if (!req.user || !req.user.isVerified) {
    return res.status(403).json({ message: 'Email not verified. Access restricted.' });
  }
  next();
};