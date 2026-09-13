import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IProduct extends Document {
  productName: string;
  categoryId: Types.ObjectId;
  productImageIds: Types.ObjectId[];
  productVariantIds: Types.ObjectId[];
  description: string;
  productStatus: 'active' | 'inactive' | 'pending' | 'discontinued';
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [3, 'Product name must be at least 3 characters'],
    maxlength: [100, 'Product name cannot exceed 100 characters'],
    match: [/^[a-zA-ZÀ-ỹ0-9\s\-]+$/, 'Product name must contain only letters, numbers, spaces, and hyphens']
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: "Categories",
    required: true,
  },
  productImageIds: [
    {
      type: Schema.Types.ObjectId,
      ref: "ProductImages",
    },
  ],
  productVariantIds: [
    {
      type: Schema.Types.ObjectId,
      ref: "ProductVariants",
    },
  ],
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [50, 'Description must be at least 50 characters'],
    maxlength: [10000, 'Description cannot exceed 10000 characters']
  },
  productStatus: {
    type: String,
    enum: ["active", "inactive", "pending", "discontinued"],
    default: "pending",
  }
}, {
  timestamps: true
});

const Product: Model<IProduct> = mongoose.model<IProduct>("Products", ProductSchema);

export default Product;

// Ensure CommonJS interop
// @ts-ignore
module.exports = Product;
// @ts-ignore
module.exports.default = Product;
