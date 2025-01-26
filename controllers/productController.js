const mongoose = require("mongoose");

require("../models/productSchema");

const Product = mongoose.model("products");
const Brand = mongoose.model("brands");
const Category = mongoose.model("categories");
const { getDataOfPage } = require("./paginationController");

const dataPerPage = 12;
const cloudinary = require('cloudinary').v2;

module.exports.getAllProducts = async (req, res, next) => {
  try {
    const filter = {};
    const sorting = {};
    const minMaxPricesFilter = {};

    if (req.query.brand && req.query.brand !== "all") {
      filter.brand = req.query.brand;
      minMaxPricesFilter.brand = req.query.brand;
    }
    if (req.query.category && req.query.category !== "all") {
      filter.category = req.query.category;
      minMaxPricesFilter.category = req.query.category;
    }

    const sortDirection = req.query.sort && (req.query.sort == -1 || req.query.sort == 1) ? Number(req.query.sort) : null;
    if (sortDirection) {
      sorting.discountedPrice = sortDirection;
    }

    // Fetch products and calculate discounted price
    const products = await Product.find(filter).lean(); // `.lean()` for better performance
    const productsWithDiscount = products.map((product) => {
      const discountedPrice = product.price - (product.price * product.discount) / 100;
      return { ...product, discountedPrice };
    });

    // Filter by price (discounted price)
    let filteredProducts = productsWithDiscount;
    if (req.query.price && req.query.price != 0) {
      filteredProducts = filteredProducts.filter((product) => product.discountedPrice <= +req.query.price);
    }

    // Sort by discounted price
    if (sortDirection) {
      filteredProducts.sort((a, b) => (a.discountedPrice - b.discountedPrice) * sortDirection);
    }

    // Pagination
    const page = req.query.page ? req.query.page : 1;
    const { totalPages, pageData } = getDataOfPage(filteredProducts, page, 40);

    // Calculate min and max prices
    const discountedPrices = filteredProducts.map((product) => product.discountedPrice);
    const minPrice = Math.min(...discountedPrices);
    const maxPrice = Math.max(...discountedPrices);

    res.status(200).json({
      data: pageData,
      totalPages,
      minPrice,
      maxPrice,
    });
  } catch (error) {
    next(error);
  }
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

module.exports.updateProduct = async (req, res, next) => {
  try {
    // Parse colors if provided
    const colors = Array.isArray(req.body.colors)
      ? req.body.colors
      : req.body.colors
      ? [req.body.colors]
      : [];
    const parsedColors = colors.map((obj) =>
      typeof obj === "object" ? obj : JSON.parse(obj)
    );

    // Initialize new images array
    let imagesArr = [];

    // Find the product to update
    const product = await Product.findById(req.body._id).exec();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // If new images are provided
    if (req.files && req.files.length > 0) {
      // Upload new images to Cloudinary
      const uploadedImages = await Promise.all(
        req.files.map((file) =>
          cloudinary.uploader.upload(file.path, { folder: "products" })
        )
      );

      // Extract Cloudinary URLs
      imagesArr = uploadedImages.map((img) => ({
        src: img.secure_url,
        public_id: img.public_id, // Save public_id for easier management
      }));

      // Delete old images from Cloudinary
      await Promise.all(
        product.images.map((img) =>
          cloudinary.uploader.destroy(img.public_id).catch((err) => {
            console.error("Failed to delete old image:", img.public_id, err);
          })
        )
      );
    } else {
      // Retain old images if no new images are uploaded
      if (req.body.images) {
        imagesArr = Array.isArray(req.body.images)
          ? req.body.images.map((img) =>
              typeof img === "string" ? JSON.parse(img) : img
            )
          : [typeof req.body.images === "string" ? JSON.parse(req.body.images) : req.body.images];
      } else {
        imagesArr = product.images; // Default to existing images if none are provided
      }
    }

    // If brand is updated
    if (req.body.brand && req.body.brand !== product.brand.toString()) {
      await Brand.updateOne({ _id: product.brand }, { $pull: { products: product._id } });
      await Brand.updateOne({ _id: req.body.brand }, { $push: { products: product._id } });
    }

    // If category is updated
    if (req.body.category && req.body.category !== product.category.toString()) {
      await Category.updateOne({ _id: product.category }, { $pull: { products_id: product._id } });
      await Category.updateOne({ _id: req.body.category }, { $push: { products_id: product._id } });
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.body._id,
      {
        ...req.body,
        images: imagesArr,
        colors: parsedColors,
      },
      { new: true }
    );

    res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    next(error); // Pass errors to the error-handling middleware
  }
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
