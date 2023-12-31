import httpStatus from 'http-status';
import mongoose from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { Cow } from '../cow/cow.model';
import { User } from '../user/user.model';
import { IOrder } from './order.interface';
import { Order } from './order.model';

const cowOrder = async (data: IOrder): Promise<IOrder | null | undefined> => {
  const session = await mongoose.startSession();
  try {
    // Simulate the transaction process
    const { cow, buyer } = data;
    session.startTransaction();

    const buyerUser = await User.findOne({
      _id: buyer,
      role: 'buyer',
    });
    const AvailableCow = await Cow.findOne({ _id: cow, label: 'for sale' });

    if (!buyerUser) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Buyer doesn't exist !");
    }

    if (!AvailableCow) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cow is not available for sale'
      );
    }

    if (AvailableCow.price > buyerUser?.budget) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Buyer budget is not enough');
    }

    const updatedBuyer = await User.findByIdAndUpdate(
      buyer,
      { budget: buyerUser.budget - AvailableCow.price },
      { new: true }
    );
    if (!updatedBuyer) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to update buyer's budget"
      );
    }

    const seller = await User.findOne({
      _id: AvailableCow.seller,
      role: 'seller',
    });

    if (!seller) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Seller doesn't exist !");
    }

    const updatedSeller = await User.findByIdAndUpdate(
      AvailableCow.seller,
      { income: seller.income + AvailableCow.price },
      { new: true }
    );
    
    if (!updatedSeller) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to update seller's income"
      );
    }

    const updatedCow = await Cow.findByIdAndUpdate(
      cow,
      { label: 'sold out' },
      { new: true }
    );

    if (!updatedCow) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to update cow's status"
      );
    }

    const order = new Order({ cow, buyer });

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    return order;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getAllOrders = async (): Promise<IOrder[]> => {
  const orders = await Order.find().populate('cow').populate('buyer');
  return orders;
};

export const OrderService = {
  cowOrder,
  getAllOrders,
};
