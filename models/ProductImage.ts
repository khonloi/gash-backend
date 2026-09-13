import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IProductImage extends Document {
  productId: Types.ObjectId;
  imageUrl: string;
  isMain: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema<IProductImage>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Products',
  },
  imageUrl: {
    type: String,
    required: true
  },
  isMain: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const ProductImage: Model<IProductImage> = mongoose.model<IProductImage>('ProductImages', ProductImageSchema);

export default ProductImage;

// Ensure CommonJS interop
// @ts-ignore
module.exports = ProductImage;
// @ts-ignore
module.exports.default = ProductImage;
