import IntervalTree from '@flatten-js/interval-tree';
import { Range } from 'vscode';


export class GenericIntervalTree<TEntity extends { range: Range }> {
	private _tree = new IntervalTree<TEntity>();

	public clear(): void {
		this._tree.clear();
	}
	public insert(entity: TEntity) {
		this._tree.insert(this.getRangeTuple(entity), entity);
	}

	public insertMany(entities: TEntity[]) {
		for (const entity of entities) {
			this.insert(entity);
		}
	}

	public remove(entity: TEntity) {
		this._tree.remove(this.getRangeTuple(entity), entity);
	}

	public getAll(): TEntity[] {
		return this._tree.items.map((item) => item.value);
	}

	public searchAll(target: Range): TEntity[] {
		return this._tree.search([target.start.line, target.end.line]) as TEntity[];
	}

	public findClosest(target: Range): { before: TEntity | null; after: TEntity | null } {
		let before: TEntity | null = null;
		let after: TEntity | null = null;

		// Find `before` using reverse iteration. This bit kind of makes the whole thing O(n) again which is pretty meh.
		// Probably need a custom structure instead of an interval tree
		for (const entity of this._tree.iterate([Number.NEGATIVE_INFINITY, target.start.line]) as TEntity[]) {
			if (entity.range.end.line < target.start.line) {
				before = entity; // Keep the last valid one
			}
		}

		// Find `after` using forward iteration
		for (const entity of this._tree.iterate([target.end.line, target.end.line])) {
			if (entity.range.start.line > target.end.line) {
				after = entity;
				break; // Stop early after first valid `after`
			}
		}

		return { before, after };
	}


	public findOneImmediatelyAfter(target: Range): TEntity | undefined {
		const iterator = this._tree.iterate([target.end.line, target.end.line]);

		for (const entity of iterator) {
			if (entity.range.start.line === target.end.line + 1) {
				return entity;
			}
			if (entity.range.start.line > target.end.line + 1) {
				// If we got here, it means there's no entity adjacent to target.end.line
				// meaning we can break early (no match)
				break;
			}
		}

		return undefined;
	}

	public findAfter(target: Range): TEntity[] {
		const result: TEntity[] = [];

		// Use iterator starting from the target.end.line to find the next elements
		const iterator = this._tree.iterate([target.end.line, target.end.line]);

		for (const entity of iterator) {
			if (entity.range.start.line > target.end.line) {
				result.push(entity);
			}
		}

		return result;
	}

	private getRangeTuple(entity: TEntity): [number, number] {
		return [entity.range.start.line, entity.range.end.line];
	}
}

