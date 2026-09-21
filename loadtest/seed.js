// Populates MongoDB directly with a realistic candidate pool and a set of
// "actor" accounts the k6 scenarios log in as, with JWTs minted the same
// way AuthService does (skips the OTP round-trip for scenarios that aren't
// specifically testing auth, since that would tank throughput on Redis
// per-phone cooldowns).
'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const MONGO_URI =
  process.env.LOADTEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/datingapp';
const JWT_SECRET = process.env.LOADTEST_JWT_SECRET ?? 'change-this-access-secret';
const BACKGROUND_COUNT = Number(process.env.LOADTEST_BACKGROUND_COUNT ?? 300);
const ACTOR_COUNT = Number(process.env.LOADTEST_ACTOR_COUNT ?? 100);
const MOSCOW = { lat: 55.7558, lng: 37.6173 };

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function jitterCoordinates() {
  // ~±0.2 degrees is roughly a 20km box around central Moscow.
  return [
    MOSCOW.lng + randomBetween(-0.2, 0.2),
    MOSCOW.lat + randomBetween(-0.2, 0.2),
  ];
}

function makeUser(phone, index) {
  const gender = index % 2 === 0 ? 'male' : 'female';
  return {
    phone,
    name: `LoadTest ${index}`,
    age: Math.floor(randomBetween(20, 45)),
    gender,
    about: 'Load test synthetic profile',
    photos: [],
    interests: [],
    goals: [],
    lifestyleOptions: [],
    isActive: true,
    isVerified: true,
    lastActiveAt: new Date(),
    searchPreferences: {
      minAge: 18,
      maxAge: 60,
      maxDistance: 100,
      genders: [],
    },
    locationType: 'Point',
    coordinates: jitterCoordinates(),
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function mintAccessToken(userId, phone) {
  return jwt.sign({ sub: userId, phone, type: 'access' }, JWT_SECRET, {
    expiresIn: '3h',
  });
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log(`Clearing previous load-test users from ${MONGO_URI} ...`);
  await db.collection('users').deleteMany({ phone: /^\+7900/ });
  await db.collection('matches').deleteMany({});
  await db.collection('dialogs').deleteMany({});
  await db.collection('messages').deleteMany({});
  await db.collection('likes').deleteMany({});

  console.log(`Inserting ${BACKGROUND_COUNT} background candidate users ...`);
  const backgroundUsers = Array.from({ length: BACKGROUND_COUNT }, (_, i) =>
    makeUser(`+7900${String(1000000 + i)}`, i),
  );
  if (backgroundUsers.length > 0) {
    await db.collection('users').insertMany(backgroundUsers);
  }

  console.log(`Inserting ${ACTOR_COUNT} actor users ...`);
  const actorDocs = Array.from({ length: ACTOR_COUNT }, (_, i) =>
    makeUser(`+7900${String(2000000 + i)}`, i),
  );
  const insertResult = await db.collection('users').insertMany(actorDocs);
  const actorIds = Object.values(insertResult.insertedIds);

  console.log('Pairing actors into matches with dialogs ...');
  const actors = actorDocs.map((doc, i) => ({
    id: actorIds[i].toString(),
    phone: doc.phone,
    dialogId: null,
  }));

  for (let i = 0; i + 1 < actors.length; i += 2) {
    const a = actors[i];
    const b = actors[i + 1];
    const [user1, user2] =
      a.id < b.id ? [new ObjectId(a.id), new ObjectId(b.id)] : [new ObjectId(b.id), new ObjectId(a.id)];

    const matchResult = await db.collection('matches').insertOne({
      user1,
      user2,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const dialogResult = await db.collection('dialogs').insertOne({
      matchId: matchResult.insertedId,
      user1,
      user2,
      isActive: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    a.dialogId = dialogResult.insertedId.toString();
    b.dialogId = dialogResult.insertedId.toString();
  }

  const actorsWithTokens = actors.map((actor) => ({
    ...actor,
    token: mintAccessToken(actor.id, actor.phone),
  }));

  const outputPath = path.join(__dirname, 'actors.json');
  fs.writeFileSync(outputPath, JSON.stringify(actorsWithTokens, null, 2));
  console.log(`Wrote ${actorsWithTokens.length} actors to ${outputPath}`);

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
