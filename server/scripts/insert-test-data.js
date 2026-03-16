/**
 * Script to insert test data into the database
 * Run with: node scripts/insert-test-data.js
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";
import { generateToken } from "../src/lib/jwt.js";
import { UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function insertTestData() {
  try {
    console.log("Starting test data insertion...");

    // Check if test business already exists
    let testBusiness = await prisma.business.findFirst({
      where: { name: "Test Business" },
    });

    if (!testBusiness) {
      console.log("Creating test business...");
      testBusiness = await prisma.business.create({
        data: {
          name: "Test Business",
          isActive: true,
        },
      });
      console.log(`✓ Created business: ${testBusiness.id}`);
    } else {
      console.log(`✓ Business already exists: ${testBusiness.id}`);
    }

    // Check if test user already exists
    let testUser = await prisma.user.findUnique({
      where: { email: "test@example.com" },
    });

    if (!testUser) {
      console.log("Creating test user...");
      const passwordHash = await hashPassword("test123456");
      testUser = await prisma.user.create({
        data: {
          email: "test@example.com",
          fullName: "Test User",
          passwordHash,
          isActive: true,
        },
      });
      console.log(`✓ Created user: ${testUser.email}`);
    } else {
      console.log(`✓ User already exists: ${testUser.email}`);
    }

    // Check if business user membership exists
    let businessUser = await prisma.businessUser.findUnique({
      where: {
        businessId_userId: {
          businessId: testBusiness.id,
          userId: testUser.id,
        },
      },
    });

    if (!businessUser) {
      console.log("Creating business user membership...");
      businessUser = await prisma.businessUser.create({
        data: {
          businessId: testBusiness.id,
          userId: testUser.id,
          role: UserRole.OWNER,
        },
      });
      console.log(`✓ Created business user membership`);
    } else {
      console.log(`✓ Business user membership already exists`);
    }

    // Create desk items from the pricing table image
    console.log("\nCreating desk items...");
    const deskItems = [
      { name: "ลอฟขาเอียง", onsitePrice: 2500, deliveryPrice: 3000 },
      { name: "ลอฟขาตรง", onsitePrice: 2500, deliveryPrice: 3000 },
      { name: "แกรนิต", onsitePrice: 2800, deliveryPrice: 3300 },
      { name: "ทรงยู", onsitePrice: 2800, deliveryPrice: 3300 },
      { name: "1.5 เมตร", onsitePrice: 6000, deliveryPrice: 6500 },
      { name: "1.8 เมตร", onsitePrice: 7000, deliveryPrice: 7500 },
    ];

    for (const item of deskItems) {
      const deskItem = await prisma.deskItem.upsert({
        where: {
          businessId_name: {
            businessId: testBusiness.id,
            name: item.name,
          },
        },
        create: {
          businessId: testBusiness.id,
          name: item.name,
          onsitePrice: item.onsitePrice,
          deliveryPrice: item.deliveryPrice,
        },
        update: {
          onsitePrice: item.onsitePrice,
          deliveryPrice: item.deliveryPrice,
        },
      });
      console.log(`  ✓ ${item.name}: ${item.onsitePrice} / ${item.deliveryPrice}`);
    }

    // Create delivery fees from the delivery fee table image
    console.log("\nCreating delivery fees...");
    const deliveryFees = [
      { range: 1, cost: 0 },      // 1-10 km: Free
      { range: 2, cost: 100 },    // 11-15 km
      { range: 3, cost: 200 },    // 16-29 km
      { range: 4, cost: 300 },    // 30-39 km
      { range: 5, cost: 400 },    // 40-49 km
      { range: 6, cost: 500 },    // 50-59 km
      { range: 7, cost: 600 },    // 60-79 km
      { range: 8, cost: 700 },    // 80-99 km
      { range: 9, cost: 1000 },   // 100-109 km
      { range: 10, cost: 1100 }, // 110-119 km
      { range: 11, cost: 1200 }, // 120-129 km
      { range: 12, cost: 1300 }, // 130-139 km
      { range: 13, cost: 1400 }, // 140-149 km
      { range: 14, cost: 1500 }, // 150-159 km
      { range: 15, cost: 1600 }, // 160-169 km
      { range: 16, cost: 1700 }, // 170-179 km
      { range: 17, cost: 1800 }, // 180-189 km
      { range: 18, cost: 1900 }, // 190-199 km
      { range: 19, cost: 2000 }, // 200-299 km
      { range: 20, cost: 2500 }, // 300+ km
    ];

    for (const fee of deliveryFees) {
      await prisma.deliveryFee.upsert({
        where: {
          businessId_range: {
            businessId: testBusiness.id,
            range: fee.range,
          },
        },
        create: {
          businessId: testBusiness.id,
          range: fee.range,
          cost: fee.cost,
        },
        update: {
          cost: fee.cost,
        },
      });
    }
    console.log(`  ✓ Created ${deliveryFees.length} delivery fee zones`);

    // Generate JWT token
    const token = generateToken({
      userId: testUser.id,
      businessId: testBusiness.id,
      businessUserId: businessUser.id,
      role: businessUser.role,
    });

    console.log("\n✅ Test data insertion complete!");
    console.log("\n📋 Summary:");
    console.log(`   Business ID: ${testBusiness.id}`);
    console.log(`   User Email: ${testUser.email}`);
    console.log(`   Password: test123456`);
    console.log(`   Role: OWNER`);
    console.log(`\n🔑 JWT Token:`);
    console.log(`   ${token}`);
    console.log(`\n💡 Use this token in Authorization header: Bearer ${token.substring(0, 50)}...`);

  } catch (error) {
    console.error("Error inserting test data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

insertTestData()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to insert test data:", error);
    process.exit(1);
  });
