const { MongoClient } = require('mongodb');

const sourceUri = process.env.SOURCE_MONGO_URI;
const targetUri = process.env.MONGO_URI;

if (!sourceUri || !targetUri) {
    console.error('SOURCE_MONGO_URI and MONGO_URI are required.');
    process.exit(1);
}

const main = async () => {
    const sourceClient = new MongoClient(sourceUri);
    const targetClient = new MongoClient(targetUri);

    try {
        await sourceClient.connect();
        await targetClient.connect();

        const sourceDb = sourceClient.db('ngitify');
        const targetDb = targetClient.db('ngitify_test');
        const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
        const mismatches = [];

        for (const { name } of collections) {
            if (name.startsWith('system.')) continue;
            const [sourceCount, targetCount] = await Promise.all([
                sourceDb.collection(name).countDocuments(),
                targetDb.collection(name).countDocuments(),
            ]);

            if (sourceCount !== targetCount) {
                mismatches.push(`${name}: ${sourceCount} != ${targetCount}`);
            }
        }

        if (mismatches.length > 0) {
            mismatches.forEach((line) => console.log(line));
            process.exit(1);
        }

        console.log('collection counts match');
    } finally {
        await sourceClient.close();
        await targetClient.close();
    }
};

main().catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
});
