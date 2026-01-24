# Nalli Nihari POS System

A modern Point of Sale (POS) system built with React, Vite, and Firebase for restaurant table management and order processing with real-time synchronization across all devices.

## Features

- **Table Management**: Create, manage, and organize tables with real-time updates
- **Order Processing**: Intuitive interface for taking food and beverage orders
- **Menu Management**: Comprehensive CRUD operations for menu items with drag-and-drop reordering
- **Real-time Synchronization**: Menu items, availability, ordering, and edits sync instantly across all connected devices using Firebase
- **Cross-Device Consistency**: All changes made on one device immediately appear on all other devices
- **Order History**: Complete record of past orders with timestamps
- **Flexible Pricing**: Dynamic menu pricing with quantity controls
- **Responsive Design**: Works on tablets, desktops, and mobile devices

## Technology Stack

- React.js with Vite build system
- React Router for navigation
- CSS for styling
- Firebase Firestore for real-time data synchronization
- LocalStorage for offline fallback
- react-dnd for drag-and-drop functionality

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## Usage

1. Navigate to the Tables page to manage tables and take orders
2. Use the Settings page to manage menu items, export/import data, and clear all data
3. Access order history from the History section

## Key Functionality

- **Menu Item Management**: Add, edit, delete, and reorder menu items in the Settings page
- **Drag-and-Drop Reordering**: Easily rearrange menu items by priority or category
- **Real-time Menu Sync**: All menu changes (additions, edits, deletions, reordering, availability toggles) instantly sync across all devices
- **Table Operations**: Create unlimited tables with multiple orders per table
- **Order Management**: Add items to orders, adjust quantities, and manage multiple orders per table
- **Cross-Device Updates**: Changes made on any device are immediately visible on all other connected devices

## Project Structure

- `src/components/` - Main UI components (TablesPage, SettingsPage, etc.)
- `src/services/` - Firebase service functions
- `src/utils/` - Utility functions
- `public/` - Static assets

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.