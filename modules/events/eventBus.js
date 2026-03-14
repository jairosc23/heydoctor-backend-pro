'use strict';

const EventEmitter = require('events');

const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

/**
 * EMR Event Bus - decouples modules via internal events.
 * Events: DOCUMENT_SIGNED, CONSULTATION_STARTED, IMAGE_CAPTURED, etc.
 */
module.exports = eventBus;
