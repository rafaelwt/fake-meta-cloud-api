const EventEmitter = require('events');

/**
 * Event Bus Singleton
 * Single EventEmitter instance shared across the application
 * Listeners register themselves by requiring this module
 */
const eventBus = new EventEmitter();

module.exports = eventBus;
