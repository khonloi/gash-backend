const Favorites = require('../models/Favorites');
const mongoose = require('mongoose');

async function addFavoriteService(productId, accountId) {
  if (!productId) {
    const err = new Error('Product ID is required');
    err.status = 400;
    throw err;
  }
  if (!mongoose.isValidObjectId(productId)) {
    const err = new Error('Invalid product ID');
    err.status = 400;
    throw err;
  }
  const existingFavorite = await Favorites.findOne({ accountId, productId });
  if (existingFavorite) {
    const err = new Error('Product already in favorites');
    err.status = 400;
    throw err;
  }
  const favorite = new Favorites({ accountId, productId });
  return await favorite.save();
}

async function getFavoritesService(accountId) {
  return await Favorites.find({ accountId }).populate({
    path: 'productId',
    populate: [
      { path: 'productVariantIds', model: 'ProductVariant' },
      { path: 'productImageIds', model: 'ProductImage' },
      { path: 'categoryId', model: 'Categories' }
    ]
  });
}

async function deleteFavoriteService(favoriteId, accountId) {
  if (!mongoose.isValidObjectId(favoriteId)) {
    const err = new Error('Invalid favorite ID');
    err.status = 400;
    throw err;
  }
  const favorite = await Favorites.findOneAndDelete({ _id: favoriteId, accountId });
  if (!favorite) {
    const err = new Error('Favorite not found or not authorized');
    err.status = 404;
    throw err;
  }
  return { message: 'Product removed from favorites successfully' };
}

module.exports = {
  addFavoriteService,
  getFavoritesService,
  deleteFavoriteService
};