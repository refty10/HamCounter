import { NextResponse } from "next/server";

import { MongoClient } from "mongodb";

const uri = "mongodb://root:password@mongodb:27017";
const client = new MongoClient(uri);

export const GET = async () => {
  try {
    await client.connect();
    const database = client.db("ham-counter");
    const collection = database.collection("counter");
    const result = await collection.find({}).toArray();
    return NextResponse.json({
      name: "ok",
      result,
    });
  } catch (error) {
    throw error;
  } finally {
    await client.close();
  }
};
