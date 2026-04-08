/**
 * Min-heap priority queue for A* open set.
 * Items are ordered by ascending score.
 */
export class BinaryHeap<T> {
  private content: T[] = [];
  private scoreFn: (item: T) => number;

  constructor(scoreFn: (item: T) => number) {
    this.scoreFn = scoreFn;
  }

  push(item: T): void {
    this.content.push(item);
    this.sinkDown(this.content.length - 1);
  }

  pop(): T | undefined {
    const result = this.content[0];
    const end = this.content.pop();
    if (this.content.length > 0 && end !== undefined) {
      this.content[0] = end;
      this.bubbleUp(0);
    }
    return result;
  }

  get size(): number {
    return this.content.length;
  }

  private sinkDown(index: number): void {
    const item = this.content[index];
    while (index > 0) {
      const parentIndex = ((index + 1) >> 1) - 1;
      const parent = this.content[parentIndex];
      if (this.scoreFn(item) >= this.scoreFn(parent)) {
        break;
      }
      this.content[parentIndex] = item;
      this.content[index] = parent;
      index = parentIndex;
    }
  }

  private bubbleUp(index: number): void {
    const length = this.content.length;
    const item = this.content[index];
    while (true) {
      const child2Index = (index + 1) << 1;
      const child1Index = child2Index - 1;
      let swapIndex = -1;

      if (child1Index < length) {
        const child1 = this.content[child1Index];
        if (this.scoreFn(child1) < this.scoreFn(item)) {
          swapIndex = child1Index;
        }
      }

      if (child2Index < length) {
        const child2 = this.content[child2Index];
        const compareWith = swapIndex === -1 ? item : this.content[child1Index];
        if (this.scoreFn(child2) < this.scoreFn(compareWith)) {
          swapIndex = child2Index;
        }
      }

      if (swapIndex === -1) break;

      this.content[index] = this.content[swapIndex];
      this.content[swapIndex] = item;
      index = swapIndex;
    }
  }
}
