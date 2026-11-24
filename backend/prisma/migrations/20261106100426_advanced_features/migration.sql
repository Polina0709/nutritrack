/*
  Warnings:

  - You are about to drop the column `title` on the `Meal` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- DropForeignKey
ALTER TABLE "FoodItem" DROP CONSTRAINT "FoodItem_mealId_fkey";

-- AlterTable
ALTER TABLE "Meal" DROP COLUMN "title",
ADD COLUMN     "totalCarbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalFat" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalProtein" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "type" "MealType" NOT NULL DEFAULT 'SNACK';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calorieGoal" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "carbGoal" DOUBLE PRECISION NOT NULL DEFAULT 200,
ADD COLUMN     "fatGoal" DOUBLE PRECISION NOT NULL DEFAULT 70,
ADD COLUMN     "proteinGoal" DOUBLE PRECISION NOT NULL DEFAULT 150,
ADD COLUMN     "targetWeight" DOUBLE PRECISION,
ADD COLUMN     "waterGoal" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "weight" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "WaterLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFood" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "proteins" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fats" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "CustomFood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "prepTime" INTEGER,
    "calories" INTEGER NOT NULL,
    "proteins" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fats" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterLog" ADD CONSTRAINT "WaterLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFood" ADD CONSTRAINT "CustomFood_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
