const ACTIVE_FILTER = { isDeleted: { $ne: true } };

const hasOwn = (object, key) =>
  Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

const isIncludingDeleted = (query) => {
  const options =
    typeof query.getOptions === 'function' ? query.getOptions() : query.options || {};
  return options.includeDeleted === true;
};

const applyQueryFilter = function applyQueryFilter() {
  if (isIncludingDeleted(this)) return;

  const filter = typeof this.getFilter === 'function' ? this.getFilter() : {};
  if (hasOwn(filter, 'isDeleted')) return;

  this.where(ACTIVE_FILTER);
};

const applyAggregateFilter = function applyAggregateFilter() {
  if (isIncludingDeleted(this)) return;
  this.pipeline().unshift({ $match: ACTIVE_FILTER });
};

const softDeletePlugin = (schema) => {
  if (!schema.path('isDeleted')) return;

  schema.pre(/^find/, applyQueryFilter);
  schema.pre('countDocuments', applyQueryFilter);
  schema.pre('aggregate', applyAggregateFilter);
};

module.exports = softDeletePlugin;
