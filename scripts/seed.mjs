import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";

const DATABASE_NAME = "Online-Course-Service";
const TEST_PASSWORD = "Exam2026!";

const accounts = [
  {
    username: "student1",
    email: "student1@example.com",
    role: "Student",
  },
  {
    username: "student2",
    email: "student2@example.com",
    role: "Student",
  },
  {
    username: "student3",
    email: "student3@example.com",
    role: "Student",
  },
  {
    username: "teacher1",
    email: "teacher1@example.com",
    role: "Teacher",
  },
  {
    username: "teacher2",
    email: "teacher2@example.com",
    role: "Teacher",
  },
  {
    username: "teacher3",
    email: "teacher3@example.com",
    role: "Teacher",
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from .env.local");
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(DATABASE_NAME);
    const users = db.collection("users");

    // Prevent multiple accounts from sharing an email address.
    await users.createIndex({ email: 1 }, { unique: true });

    for (const account of accounts) {
      const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

      const result = await users.updateOne(
        { email: account.email },
        {
          // Existing accounts are left unchanged when rerunning.
          $setOnInsert: {
            ...account,
            password: hashedPassword,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      const action = result.upsertedCount === 1 ? "Created" : "Already exists";
      console.log(`${action}: ${account.email} (${account.role})`);
    }

    console.log(`Finished seeding ${DATABASE_NAME}.users`);
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
});