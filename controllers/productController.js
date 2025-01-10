const mongoose = require("mongoose");

require("../models/productSchema");

const Product = mongoose.model("products");
const Brand = mongoose.model("brands");
const Category = mongoose.model("categories");
const { getDataOfPage } = require("./paginationController");

const dataPerPage = 12;
const cloudinary = require('cloudinary').v2;

module.exports.getAllProducts = (req, res, next) => {
  const filter = {};
  const sorting = {};
  const minMaxPricesFilter = {};
  if (req.query.price && req.query.price != 0) {
    filter.price = { $lte: +req.query.price };
  }
  if (req.query.brand && req.query.brand !== "all") {
    filter.brand = req.query.brand;
    minMaxPricesFilter.brand = req.query.brand;
  }
  if (req.query.category && req.query.category !== "all") {
    filter.category = req.query.category;
    minMaxPricesFilter.category = req.query.category;
  }
  if (req.query.sort && (req.query.sort == -1 || req.query.sort == 1)) {
    sorting.price = Number(req.query.sort);
  }
  Product.find(filter)
    .sort(sorting)
    .then(async (data) => {
      let maxPrice, minPrice;
      // handle pagination
      const page = req.query.page ? req.query.page : 1;
      const { totalPages, pageData } = getDataOfPage(data, page, dataPerPage);
      // handle max and min price of products
      if (req.query.sort === 1) {
        minPrice = data[0];
        maxPrice = data[data.length - 1];
      } else if (req.query.sort === -1) {
        maxPrice = data[0];
        minPrice = data[data.length - 1];
      } else {
        [minPrice, maxPrice] = await Product.find(minMaxPricesFilter, {
          price: 1,
        })
          .sort({ price: 1 })
          .then((data) => [
            data[0] ? data[0].price : 0,
            data[0] ? data[data.length - 1].price : 0,
          ])
          .catch((error) => next(error));
      }
      res.status(200).json({
        data: pageData,
        totalPages,
        minPrice,
        maxPrice,
      });
    })
    .catch((error) => next(error));
};

module.exports.getDashboardProducts = (req, res, next) => {
  Product.find()
    .populate("brand")
    .populate("category")
    .then((data) => {
      const { totalPages, pageData } = getDataOfPage(data, req.query.page);
      res.status(200).json({
        data: pageData,
        totalPages,
        totalProducts: data.length,
      });
    })
    .catch((error) => next(error));
};

module.exports.getProductById = (req, res, next) => {
  Product.findOne({ _id: req.params.id })
    .populate("brand")
    .populate("category")
    .then((obj) => {
      if (obj === null) {
        throw new Error("product isn't found");
      }
      res.status(200).json(obj);
    })
    .catch((error) => next(error));
};

module.exports.searchForProduct = (req, res, next) => {
  const regex = new RegExp(req.query.search, "ig");
  Product.find()
    .populate("brand")
    .populate("category")
    .then((data) => {
      const arr = data.filter(
        (ele) =>
          regex.test(ele.name) ||
          regex.test(ele._id) ||
          regex.test(ele.category.name) ||
          regex.test(ele.brand.name)
      );
      return arr;
    })
    .then((data) => {
      const page = req.query.page ? req.query.page : 1;
      const { totalPages, pageData } = getDataOfPage(data, page, dataPerPage);
      res.status(200).json({
        data: pageData,
        totalPages,
        totalResults: data.length,
      });
    })
    .catch((error) => next(error));
};

module.exports.addProduct = async (req, res, next) => {
  try {
    console.log(req.files)
    console.log(req.body)
    // Validate if files exist
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images provided for upload." });
    }

    // Upload images to Cloudinary
    const uploadedImages = await Promise.all(
      req.files.map((file) =>
        cloudinary.uploader.upload(file.path, { folder: "products" })
      )
    );

    // Extract Cloudinary URLs
    const imagesArr = uploadedImages.map((img) => ({
      src: img.secure_url,
      public_id: img.public_id, // Save public_id for easier management (deletion, updates)
    }));

    // Parse colors if provided
    const colors = req.body.colors
      ? req.body.colors.map((color) =>
          typeof color === "string" ? JSON.parse(color) : color
        )
      : [];

    // Create the product object
    const product = new Product({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      images: imagesArr,
      colors,
      discount: req.body.discount || 0,
      category: req.body.category,
      brand: req.body.brand,
    });

    // Save product to the database
    const savedProduct = await product.save();

    // Add product to brand and category
    await Brand.updateOne(
      { _id: savedProduct.brand },
      { $push: { products: savedProduct._id } }
    );
    await Category.updateOne(
      { _id: savedProduct.category },
      { $push: { products_id: savedProduct._id } }
    );

    // Return success response
    res.status(201).json({ message: "Product added successfully", product: savedProduct });
  } catch (error) {
    console.error("Error adding product:", error);
    next(error); // Pass errors to error-handling middleware
  }
};


module.exports.updateProduct = (req, res, next) => {
  let imagesArr;
  if (req.files) {
    imagesArr = req.files.map((img) => {
      return { src: img.path };
    });
  }
  const parsedColors = req.body.colors.map((obj) =>
    typeof obj === "object" ? obj : JSON.parse(obj)
  );
  Product.findOne({ _id: req.body._id }, { category: 1, brand: 1, images: 1 })
    .then((obj) => {
      // check if brand was updated
      if (req.body.brand) {
        // remove product from old brand
        Brand.updateOne({ _id: obj.brand }, { $pull: { products: obj._id } })
          .then(() => true)
          .catch((error) => next(error));
        // add product to updated brand
        Brand.updateOne(
          { _id: req.body.brand },
          { $push: { products: obj._id } }
        )
          .then(() => true)
          .catch((error) => next(error));
      }
      // check if category was updated
      if (req.body.category) {
        // remove product from old category
        Category.updateOne(
          { _id: obj.category },
          { $pull: { products_id: obj._id } }
        )
          .then(() => true)
          .catch((error) => next(error));
        // add product to updated category
        Category.updateOne(
          { _id: req.body.category },
          { $push: { products_id: obj._id } }
        )
          .then(() => true)
          .catch((error) => next(error));
      }
      // check if old images were modified
      if (req.body.images) {
        if (Array.isArray(req.body.images)) {
          const updatedImages = obj.images.filter((oldImg) => {
            return (
              req.body.images.findIndex(
                (img) => JSON.parse(img)._id == oldImg._id
              ) !== -1
            );
          });
          imagesArr.push(...updatedImages);
        } else {
          const oldImg = obj.images.find(
            (ele) => ele._id == JSON.parse(req.body.images)._id
          );
          imagesArr.push(oldImg);
        }
      }
      return Product.updateOne(
        { _id: req.body._id },
        {
          $set: imagesArr
            ? { ...req.body, images: imagesArr, colors: parsedColors }
            : { ...req.body, colors: parsedColors },
        }
      );
    })
    .then((obj) => res.status(200).json(obj))
    .catch((error) => next(error));
};

module.exports.deleteProduct = (req, res, next) => {
  Brand.updateOne(
    { _id: req.query.brand },
    { $pull: { products: req.query._id } }
  )
    .then(() => true)
    .catch((error) => next(error));
  Category.updateOne(
    { _id: req.query.category },
    { $pull: { products_id: req.query._id } }
  )
    .then(() => true)
    .catch((error) => next(error));
  Product.deleteOne({ _id: req.query._id })
    .then((info) => {
      res.status(200).json(info);
    })
    .catch((error) => next(error));
};
