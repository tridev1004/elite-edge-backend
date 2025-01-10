const express = require("express");
const multer = require("multer");

const validations = require("../middlewares/validations/productValidation");
const validator = require("../middlewares/validations/validator");
const controller = require("../controllers/productController");
const { isAdmin, verifyToken } = require("../middlewares/authMw");
const upload = require("../utils/cloudinary.config");

const router = express.Router();

router
  .route("/products")
  .get(controller.getAllProducts)
  .post(
    verifyToken,
    isAdmin,
    upload.array("images", 5),
    validations.postValidation,
    validator,
    controller.addProduct
  )
  .patch(
    verifyToken,
    isAdmin,
    upload.single("images"),
    validations.updateValidation,
    validator,
    controller.updateProduct
  )
  .delete(
    verifyToken,
    isAdmin,
    validations.deleteValidation,
    validator,
    controller.deleteProduct
  );

router
  .route("/products/search")
  .get(validations.searchValidation, validator, controller.searchForProduct);

router.route("/products/dashboard").get(controller.getDashboardProducts);

router
  .route("/products/:id")
  .get(validations.idValidation, validator, controller.getProductById);

module.exports = router;
