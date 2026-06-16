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

  static async assertThrows(
    action: () => Promise<unknown>,
    expectedMessage?: string,
  ): Promise<void> {
    let thrown: unknown;
    try {
      await action();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    if (expectedMessage !== undefined) {
      expect((thrown as Error).message).toBe(expectedMessage);
    }
  }

  static async assertDatabaseError(
    action: () => Promise<unknown>,
    expectedCode: string,
  ): Promise<void> {
    let thrown: unknown;
    try {
      await action();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as { code?: string }).code).toBe(expectedCode);
  }
}
