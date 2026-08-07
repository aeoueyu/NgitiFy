const { MongoClient } = require('mongodb');

const sourceUri = process.env.SOURCE_MONGO_URI || process.env.MONGO_URI;

if (!sourceUri) {
    console.error('SOURCE_MONGO_URI or MONGO_URI is required.');
    process.exit(1);
}

const getDbNameFromUri = (uriString) => {
    const url = new URL(uriString);
    const dbName = url.pathname.replace(/^\/+/, '').trim();
    if (!dbName) {
        throw new Error('Source MongoDB URI must include a database name.');
    }
    return dbName;
};

const buildUriForDb = (uriString, dbName) => {
    const url = new URL(uriString);
    url.pathname = `/${dbName}`;
    return url.toString();
};

const sourceDbName = process.argv[2] || getDbNameFromUri(sourceUri);
const targetDbName = process.argv[3] || 'ngitify_test';
const targetUri = buildUriForDb(sourceUri, targetDbName);

const copyCollection = async (sourceDb, targetDb, collectionName) => {
    const sourceCollection = sourceDb.collection(collectionName);
    const targetCollection = targetDb.collection(collectionName);
    const cursor = sourceCollection.find({});
    const batchSize = 500;
    let batch = [];

    while (await cursor.hasNext()) {
        batch.push(await cursor.next());
        if (batch.length >= batchSize) {
            await targetCollection.insertMany(batch, { ordered: true });
            batch = [];
        }
    }

    if (batch.length > 0) {
        await targetCollection.insertMany(batch, { ordered: true });
    }
};

const main = async () => {
    const sourceClient = new MongoClient(sourceUri);
    const targetClient = new MongoClient(targetUri);

    try {
        await sourceClient.connect();
        await targetClient.connect();

        const sourceDb = sourceClient.db(sourceDbName);
        const targetDb = targetClient.db(targetDbName);

        await targetDb.dropDatabase();

        const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();

        for (const { name } of collections) {
            if (name.startsWith('system.')) {
                continue;
            }

            await copyCollection(sourceDb, targetDb, name);
        }

        console.log(`Copied ${sourceDbName} to ${targetDbName}.`);
    } finally {
        await sourceClient.close();
        await targetClient.close();
    }
};

main().catch((error) => {
    console.error('Database copy failed:', error);
    process.exit(1);
});
