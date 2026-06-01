import { ConsoleLogger, Injectable } from "@nestjs/common";
import { logContextStorage } from "./logging-context.storage";

@Injectable()
export class GcpJsonLogger extends ConsoleLogger {
  private readonly useJson =
    process.env.JSON_LOGGING === "true" ||
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "uat";

  private readonly projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCS_PROJECT_ID ||
    "contactbook";

  override log(message: unknown, ...optionalParams: unknown[]): void {
    if (this.useJson) {
      this.printJson("INFO", message, optionalParams);
    } else {
      super.log(message, ...optionalParams);
    }
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    if (this.useJson) {
      this.printJson("ERROR", message, optionalParams);
    } else {
      super.error(message, ...optionalParams);
    }
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    if (this.useJson) {
      this.printJson("WARNING", message, optionalParams);
    } else {
      super.warn(message, ...optionalParams);
    }
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    if (this.useJson) {
      this.printJson("DEBUG", message, optionalParams);
    } else {
      super.debug(message, ...optionalParams);
    }
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    if (this.useJson) {
      this.printJson("DEBUG", message, optionalParams);
    } else {
      super.verbose(message, ...optionalParams);
    }
  }

  private printJson(
    severity: string,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const { logMessage, context, metadata, stack } = this.parseLogArguments(
      message,
      optionalParams,
    );

    const store = logContextStorage.getStore();

    const payload: Record<string, unknown> = {
      severity,
      message: logMessage,
      time: new Date().toISOString(),
      ...metadata,
    };

    if (context) {
      payload.context = context;
    }

    if (stack) {
      payload.stack_trace = stack;
    }

    if (store) {
      payload.requestId = store.requestId;
      if (store.traceId) {
        payload["logging.googleapis.com/trace"] =
          `projects/${this.projectId}/traces/${store.traceId}`;
      }
      if (store.spanId) {
        payload["logging.googleapis.com/spanId"] = store.spanId;
      }
    }

    const serialized = JSON.stringify(payload) + "\n";

    if (["ERROR", "CRITICAL", "ALERT", "EMERGENCY"].includes(severity)) {
      process.stderr.write(serialized);
    } else {
      process.stdout.write(serialized);
    }
  }

  private parseLogArguments(
    message: unknown,
    optionalParams: unknown[],
  ): {
    logMessage: string;
    context: string;
    metadata: Record<string, unknown>;
    stack?: string;
  } {
    let logMessage = "";
    let context = this.context || "";
    let metadata: Record<string, unknown> = {};
    let stack: string | undefined;

    const params = [...optionalParams];

    // Extract context string if it's the last element
    if (params.length > 0) {
      const lastParam = params[params.length - 1];
      if (typeof lastParam === "string") {
        context = lastParam;
        params.pop();
      }
    }

    // Process primary message
    if (message instanceof Error) {
      logMessage = message.message;
      stack = message.stack;
      metadata.error = {
        name: message.name,
        message: message.message,
      };
    } else if (typeof message === "object" && message !== null) {
      const { message: msgProp, ...rest } = message as Record<string, unknown>;
      logMessage =
        typeof msgProp === "string"
          ? msgProp
          : typeof msgProp === "number" || typeof msgProp === "boolean"
            ? String(msgProp)
            : typeof msgProp === "object" && msgProp !== null
              ? JSON.stringify(msgProp)
              : JSON.stringify(message);
      metadata = { ...metadata, ...rest };
    } else {
      logMessage =
        typeof message === "symbol" || typeof message === "function"
          ? ""
          : String(message);
    }

    // Process other parameters
    for (const param of params) {
      if (param instanceof Error) {
        stack = param.stack;
        metadata.error = {
          name: param.name,
          message: param.message,
        };
      } else if (typeof param === "object" && param !== null) {
        metadata = { ...metadata, ...(param as Record<string, unknown>) };
      } else if (typeof param === "string") {
        if (param.includes("\n")) {
          stack = param;
        } else {
          metadata.extra = param;
        }
      }
    }

    return { logMessage, context, metadata, stack };
  }
}
