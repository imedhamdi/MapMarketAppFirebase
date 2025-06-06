# MapMarket Firebase

This repository contains a minimalist demo of a map based marketplace powered entirely by Firebase.

## Deployment

1. Create a Firebase project and configure `.firebaserc` with your project id.
2. Install the Firebase CLI then run the following commands:

```bash
firebase use <your-project-id>
firebase deploy
```

## Firestore Indexes

Indexes used by the application are defined in `firestore.indexes.json`. Run `firebase deploy --only firestore:indexes` to deploy them.

## Environment variables

Cloud Functions expect a file named `env.local` at the project root to define environment configuration such as Algolia credentials. Copy `env.local.example` and adjust the values:

```bash
cp env.local.example env.local
```

## Tests

Unit tests (if any) can be executed with `npm test` inside the `functions` directory.
