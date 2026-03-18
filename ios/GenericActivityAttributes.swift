import ActivityKit
import Foundation

/// A type-erased Codable value for dictionary-based ActivityAttributes.
/// Supports: String, Double, Bool. Date values are stored as Unix timestamps (Double).
///
/// NOTE: Keep in sync with the duplicated copy in GeneratedLiveActivity.swift (Widget Extension).
/// Both must have the same enum cases and accessor names.
@available(iOS 16.2, *)
public enum CodableValue: Codable, Hashable {
    case string(String)
    case double(Double)
    case bool(Bool)

    // MARK: - Codable

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let boolValue = try? container.decode(Bool.self) {
            self = .bool(boolValue)
        } else if let doubleValue = try? container.decode(Double.self) {
            self = .double(doubleValue)
        } else if let stringValue = try? container.decode(String.self) {
            self = .string(stringValue)
        } else {
            throw DecodingError.typeMismatch(
                CodableValue.self,
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "Unsupported CodableValue type"
                )
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .double(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        }
    }

    // MARK: - Accessors

    public var stringValue: String? {
        if case .string(let v) = self { return v }
        return nil
    }

    public var doubleValue: Double? {
        if case .double(let v) = self { return v }
        return nil
    }

    public var boolValue: Bool? {
        if case .bool(let v) = self { return v }
        return nil
    }
}

/// Generic ActivityAttributes usable by any Live Activity configuration.
/// Fields are stored as dictionaries rather than typed struct properties,
/// allowing the library to call ActivityKit directly without app-specific types.
@available(iOS 16.2, *)
public struct GenericActivityAttributes: ActivityAttributes {
    public var data: [String: CodableValue]

    public struct ContentState: Codable, Hashable {
        public var data: [String: CodableValue]

        public init(data: [String: CodableValue] = [:]) {
            self.data = data
        }

        /// Helper for SwiftUI access in generated widget code
        public func value(_ key: String) -> CodableValue? {
            return data[key]
        }
    }

    public init(data: [String: CodableValue] = [:]) {
        self.data = data
    }
}
