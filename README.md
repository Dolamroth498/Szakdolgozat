# Svindli

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.0.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Testing Firestore security rules

In a separate terminal, start the Firestore emulator for the application:

```bash
npm run emulator:firestore
```

It uses the `svindli-25ccf` project ID and listens on port 8080. While it runs, start the Angular app with `npm start`. Development mode connects Firestore to this emulator; emulator data is local and is not your production database.

To run the rules tests with the emulator already running on port 8080, use:

```bash
npm run test:rules
```

To start the emulator for the test run and stop it afterward, use:

```bash
npm run test:rules:emulator
```

The rules test command starts its own emulator with the demo project ID `demo-svindli-rules`, does not access production Firestore, and stops the emulator afterward. The emulator requires Java 11 or later.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
