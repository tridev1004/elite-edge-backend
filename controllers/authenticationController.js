const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = mongoose.model("users");

module.exports.login = (req, res, next) => {
  let token;
  // Check if admin
  if (
    req.body.email === process.env.adminEmail &&
    req.body.password === process.env.adminPass
  ) {
    // Generate token for admin
    token = jwt.sign(
      {
        email: process.env.adminEmail,
        role: "admin",
      },
      process.env.secretKey,
      { expiresIn: "6h" }
    );
    
    // Return response for successful admin login
    return res.status(200).json({
      message: "Admin login successful",
      data: {
        email: process.env.adminEmail,
        role: "admin",
      },
      token: token,
    });
  } else {
    // If not admin, proceed with user login
    User.findOne({ email: req.body.email })
      .then((userObj) => {
        if (userObj === null) {
          throw new Error("not authenticated");
        }
        let result = bcrypt.compareSync(req.body.password, userObj.password);
        if (!result) {
          throw new Error("not authenticated");
        }
        token = jwt.sign(
          {
            email: req.body.email,
            id: userObj._id,
            role: "user",
          },
          process.env.secretKey,
          { expiresIn: "6h" }
        );
        res.status(200).json({ data: "ok", token });
      })
      .catch((error) => next(error));
  }
};
