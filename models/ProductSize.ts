import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IProductSize extends Document {
  size_name: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSizeSchema = new Schema<IProductSize>({
  size_name: {
    type: String,
    required: [true, 'Size name is required'],
    minlength: [1, 'Size name must be at least 1 character'],
    maxlength: [12, 'Size name cannot exceed 12 characters']
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const ProductSize: Model<IProductSize> = mongoose.model<IProductSize>('ProductSizes', ProductSizeSchema);

export default ProductSize;

// Ensure CommonJS interop
// @ts-ignore
module.exports = ProductSize;
// @ts-ignore
module.exports.default = ProductSize;
