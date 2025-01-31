/**
 * For ordering Subgraph queries.
 * @type TOrderBy Name of the field which the query is order by.
 * WARNING: Ordering by `id` in `desc` order breaks {@link LastIdPaging}.
 */
export type Ordering<TOrderBy extends string> = {
    orderBy: TOrderBy,
    orderDirection: OrderDirection
};

/**
 * The subgraph query ordering direction.
 */
export type OrderDirection =
    | 'asc'
    | 'desc';
