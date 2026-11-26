import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js"; // Adjust path/extension if using CommonJS (require)


const firstNames = [
  "Liam", "Emma", "Noah", "Olivia", "Conor", "Aoife", "Sean", "Ciara", "Cian", "Niamh",
  "Jack", "Sophie", "Oisin", "Saoirse", "Darragh", "Roisin", "Tadhg", "Maeve", "Fionn", "Grace",
  "Luke", "Hannah", "Adam", "Ella", "Daniel", "Emily", "James", "Chloe", "Ryan", "Lucy",
  "Alex", "Mia", "Ben", "Ava", "Ethan", "Zoe", "Harry", "Lily", "Sam", "Sarah",
  "Dylan", "Katie", "Leo", "Ruby", "Oscar", "Eva", "Max", "Holly", "Jake", "Anna"
];

const lastNames = [
  "Murphy", "Kelly", "Byrne", "Ryan", "O'Brien", "Walsh", "O'Sullivan", "O'Connor", "Doyle", "McCarthy",
  "Gallagher", "O'Neill", "Lynch", "Murray", "Quinn", "Moore", "McLoughlin", "Carroll", "Connolly", "Daly",
  "Connell", "Wilson", "Dunne", "Brennan", "Burke", "Collins", "Campbell", "Clarke", "Johnston", "Hughes",
  "Farrell", "Fitzgerald", "Brown", "Martin", "Maguire", "Nolan", "Flynn", "Thompson", "Callaghan", "O'Donnell",
  "Duffy", "Boyle", "Healy", "Shea", "White", "Sweeney", "Hayes", "Kavanagh", "Power", "McGrath"
];

const fitnessGoals = ["Weight Loss", "Muscle Gain", "Endurance", "General Fitness", "Flexibility"];
const activityLevels = ["Beginner", "Intermediate", "Advanced"];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas...");

    const hashedAdminPassword = await bcrypt.hash("Admin@12345", 10);
    const hashedMemberPassword = await bcrypt.hash("Member@12345", 10);

    // 1. Check if default admin exists; create or update with full access
    const adminEmail = "admin@fitcoach.ie";
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      existingAdmin.role = "admin";
      existingAdmin.isAdmin = true;
      await existingAdmin.save();
      console.log(`Default admin already exists (${adminEmail}) — verified full admin privileges.`);
    } else {
      await User.create({
        name: "FitCoach System Admin",
        email: adminEmail,
        password: hashedAdminPassword,
        role: "admin",
        isAdmin: true,
        age: 32,
        profile: {
          age: 32,
          gender: "Other",
          height: 178,
          weight: 75,
          goal: "General Fitness",
          activityLevel: "Advanced",
          onboardingCompleted: true
        }
      });
      console.log(`Created default admin: ${adminEmail} / Admin@12345`);
    }

    // 2. Remove previously seeded test members (keeps your real accounts intact)
    await User.deleteMany({ email: { $regex: /^member\d+@fitcoach\.ie$/ } });

    // 3. Build 50 realistic test members
    const members = [];
    for (let i = 1; i <= 50; i++) {
      const firstName = firstNames[(i - 1) % firstNames.length];
      const lastName = lastNames[(i - 1) % lastNames.length];
      const age = 19 + (i % 38); // Ages 19 to 56
      const weight = 55 + (i % 45); // 55kg to 99kg
      const height = 158 + (i % 35); // 158cm to 192cm
      const goal = fitnessGoals[i % fitnessGoals.length];
      const activityLevel = activityLevels[i % activityLevels.length];

      members.push({
        name: `${firstName} ${lastName}`,
        email: `member${i}@fitcoach.ie`,
        password: hashedMemberPassword,
        role: "member",
        isAdmin: false,
        age,
        profile: {
          age,
          gender: i % 2 === 0 ? "Female" : "Male",
          height,
          weight,
          goal,
          activityLevel,
          onboardingCompleted: true
        }
      });
    }

    await User.insertMany(members);
    console.log("Successfully seeded 50 test members (member1@fitcoach.ie to member50@fitcoach.ie).");
    console.log("Default member password: Member@12345");

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seedDatabase();