# Rate Shield - Angular Frontend

This is the Angular version of the Rate Shield frontend, converted from React.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Angular CLI (optional, but recommended)

## Installation

1. Navigate to the project directory:
```bash
cd rate-shield-angular
```

2. Install dependencies:
```bash
npm install
```

## Configuration

The API base URL is configured in `src/environments/environment.ts`. By default, it points to `http://localhost:8080`.

To change the API URL, update the `apiUrl` in:
- `src/environments/environment.ts` (for development)
- `src/environments/environment.prod.ts` (for production)

## Running the Application

### Development Server

```bash
npm start
```

or

```bash
ng serve
```

The application will be available at `http://localhost:4200`

### Production Build

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Features

- **API Configuration**: Manage rate limiting rules for your APIs
- **Multiple Strategies**: Support for Token Bucket, Fixed Window Counter, and Sliding Window Counter
- **Pagination**: Browse through rules with pagination support
- **Search**: Search rules by endpoint
- **CRUD Operations**: Create, read, update, and delete rate limiting rules
- **Responsive UI**: Built with Tailwind CSS for a modern, responsive design

## Project Structure

```
src/
├── app/
│   ├── components/          # Reusable components
│   │   ├── sidebar/
│   │   ├── button/
│   │   ├── api-configuration-header/
│   │   ├── rules-table/
│   │   ├── add-or-update-rule/
│   │   └── content-area/
│   ├── pages/               # Page components
│   │   ├── api-configuration/
│   │   └── about/
│   ├── services/            # API services
│   │   └── rules.service.ts
│   ├── models/              # TypeScript models
│   │   └── rule.model.ts
│   ├── utils/               # Utility functions
│   │   └── validators.ts
│   ├── app.component.ts     # Root component
│   └── app.config.ts        # App configuration
├── environments/            # Environment configurations
├── styles.css              # Global styles
└── index.html              # HTML entry point
```

## Technologies Used

- **Angular 18**: Frontend framework
- **TypeScript**: Programming language
- **Tailwind CSS**: Utility-first CSS framework
- **ngx-toastr**: Toast notifications
- **RxJS**: Reactive programming library

## API Integration

The application communicates with the Rate Shield backend API. Ensure the backend is running on `http://localhost:8080` or update the API URL in the environment configuration.

### API Endpoints Used

- `GET /rule/list` - Get paginated list of rules
- `GET /rule/search?endpoint={endpoint}` - Search rules by endpoint
- `POST /rule/add` - Create a new rule
- `POST /rule/delete` - Delete a rule

## Troubleshooting

### Port Already in Use

If port 4200 is already in use, you can specify a different port:
```bash
ng serve --port 4300
```

### API Connection Issues

If you get CORS errors, ensure:
1. The backend is running on `http://localhost:8080`
2. The backend has CORS enabled
3. The API URL in `environment.ts` is correct

### Build Issues

If you encounter build issues, try:
```bash
npm install
npm run build
```

## License

This project is part of the Rate Shield project.
