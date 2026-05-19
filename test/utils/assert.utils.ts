import { HttpException } from '@nestjs/common';

export class AssertUtils {
  static async assertError(
    action: () => Promise<unknown>,
    expectedMessage: string,
    expectedStatusCode: number,
  ): Promise<void> {
    let thrown: unknown;
    try {
      await action();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).message).toBe(expectedMessage);
    expect((thrown as HttpException).getStatus()).toBe(expectedStatusCode);
  }
}
