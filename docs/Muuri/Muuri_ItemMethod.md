Item Methods#
getGrid#
item.getGrid()

Get the grid instance the item belongs to.

Returns  —  Muuri

Examples

javascript
const grid = item.getGrid();
getElement#
item.getElement()

Get the item element.

Returns  —  element

Examples

javascript
const elem = item.getElement();
getWidth#
item.getWidth()

Get item element's cached width (in pixels). The returned value includes the element's paddings and borders.

Returns  —  number

Examples

javascript
const width = item.getWidth();
getHeight#
item.getWidth()

Get item element's cached height (in pixels). The returned value includes the element's paddings and borders.

Returns  —  number

Examples

javascript
const height = item.getHeight();
getMargin#
item.getMargin()

Get item element's cached margins (in pixels).

Returns  —  object

obj.left  —  number
obj.right  —  number
obj.top  —  number
obj.bottom  —  number
Examples

javascript
const margin = item.getMargin();
getPosition#
item.getPosition()

Get item element's cached position (in pixels, relative to the grid element).

Returns  —  object

obj.left  —  number
obj.top  —  number
Examples

javascript
const position = item.getPosition();
isActive#
item.isActive()

Check if the item is currently active. Only active items are considered to be part of the layout.

Returns  —  boolean

Examples

javascript
const isActive = item.isActive();
isVisible#
item.isVisible()

Check if the item is currently visible.

Returns  —  boolean

Examples

javascript
const isVisible = item.isVisible();
isShowing#
item.isShowing()

Check if the item is currently animating to visible.

Returns  —  boolean

Examples

javascript
const isShowing = item.isShowing();
isHiding#
item.isHiding()

Check if the item is currently animating to hidden.

Returns  —  boolean

Examples

javascript
const isHiding = item.isHiding();
isPositioning#
item.isPositioning()

Check if the item is currently being positioned.

Returns  —  boolean

Examples

javascript
const isPositioning = item.isPositioning();
isDragging#
item.isDragging()

Check if the item is currently being dragged.

Returns  —  boolean

Examples

javascript
const isDragging = item.isDragging();
isReleasing#
item.isReleasing()

Check if the item is currently being released.

Returns  —  boolean

Examples

javascript
const isReleasing = item.isReleasing();
isDestroyed#
item.isDestroyed()

Check if the item is destroyed.

Returns  —  boolean

Examples

javascript
const isDestroyed = item.isDestroyed();
